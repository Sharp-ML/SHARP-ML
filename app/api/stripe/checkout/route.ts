import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, UNLIMITED_ACCESS_PRICE } from "@/lib/stripe";

function getBaseUrl(request: NextRequest): string {
  // First check explicit env var
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // On Vercel, use the deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fallback: derive from request headers
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  if (host) {
    return `${protocol}://${host}`;
  }
  
  // Final fallback for local development
  return "http://localhost:3000";
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user exists and get their Stripe customer ID
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        stripeCustomerId: true, 
        isPaid: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if already paid
    if (user.isPaid) {
      return NextResponse.json(
        { error: "You already have unlimited access" },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: session.user.name || undefined,
        metadata: {
          userId: session.user.id,
        },
      });
      customerId = customer.id;
      
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session for subscription
    const baseUrl = getBaseUrl(request);
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: UNLIMITED_ACCESS_PRICE,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}?payment=success`,
      cancel_url: `${baseUrl}?payment=cancelled`,
      metadata: {
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
