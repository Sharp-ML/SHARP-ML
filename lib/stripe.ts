import Stripe from "stripe";

// Lazily initialize Stripe to avoid build-time errors when env vars aren't set
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return stripeInstance;
}

// For backwards compatibility, export a getter that lazily initializes
export const stripe = {
  get instance(): Stripe {
    return getStripe();
  },
};

// Price for unlimited access (one-time payment)
export const UNLIMITED_ACCESS_PRICE = process.env.STRIPE_PRICE_ID || "";
