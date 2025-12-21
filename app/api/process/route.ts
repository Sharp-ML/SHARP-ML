import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import Replicate from "replicate";

// Route segment config for App Router
export const runtime = "nodejs";
export const maxDuration = 60;

// Generate unique filename
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload PNG, JPG, or WEBP." },
        { status: 400 }
      );
    }

    // Check for required environment variables
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    
    if (!replicateToken) {
      return NextResponse.json(
        {
          error: "Server configuration error",
          message: "REPLICATE_API_TOKEN is not configured. Please add it to your environment variables.",
          setup: {
            step1: "Get your API token from https://replicate.com/account/api-tokens",
            step2: "Add REPLICATE_API_TOKEN to your Vercel environment variables",
            step3: "Redeploy your application",
          },
        },
        { status: 500 }
      );
    }
    
    if (!blobToken) {
      return NextResponse.json(
        {
          error: "Server configuration error",
          message: "BLOB_READ_WRITE_TOKEN is not configured. Please add it to your environment variables.",
          setup: {
            step1: "Go to your Vercel project dashboard",
            step2: "Navigate to Storage > Create Database > Blob",
            step3: "Connect the Blob storage to your project - this will auto-add BLOB_READ_WRITE_TOKEN",
            step4: "Redeploy your application",
          },
        },
        { status: 500 }
      );
    }

    // Generate unique ID for this upload
    const id = generateId();
    const ext = file.name.split(".").pop() || "jpg";
    const inputFileName = `uploads/${id}.${ext}`;

    // Upload to Vercel Blob
    const blob = await put(inputFileName, file, {
      access: "public",
    });

    const imageUrl = blob.url;

    // Initialize Replicate client
    const replicate = new Replicate({
      auth: replicateToken,
    });

    // Run TripoSR model for image-to-3D conversion
    // This model generates a 3D mesh from a single image
    const output = await replicate.run(
      "camenduru/tripo-sr:be24b3cc30b7b8004fb41a0b73bee94ea9a1a4d90a7f8fa1df8ee0c5d4dc4c45",
      {
        input: {
          image: imageUrl,
          mc_resolution: 256,
          foreground_ratio: 0.85,
        },
      }
    );

    // The output is a URL to the generated 3D model
    // Replicate returns different formats depending on the model
    let modelUrl: string | null = null;
    if (typeof output === "string") {
      modelUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      modelUrl = String(output[0]);
    } else if (output && typeof output === "object" && "mesh" in output) {
      modelUrl = String((output as { mesh: string }).mesh);
    }

    if (!modelUrl) {
      return NextResponse.json(
        { error: "3D generation failed - no output received" },
        { status: 500 }
      );
    }

    // Download the generated model and upload to Vercel Blob for permanent storage
    const modelResponse = await fetch(modelUrl);
    if (!modelResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download generated 3D model" },
        { status: 500 }
      );
    }

    const modelBuffer = await modelResponse.arrayBuffer();
    const modelFileName = `outputs/${id}.glb`;

    const modelBlob = await put(modelFileName, new Blob([modelBuffer]), {
      access: "public",
      contentType: "model/gltf-binary",
    });

    return NextResponse.json({
      success: true,
      modelUrl: modelBlob.url,
      imageUrl: imageUrl,
      modelType: "glb",
      message: "3D model generated successfully",
    });
  } catch (error) {
    console.error("Processing error:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle specific Replicate errors
    if (error instanceof Error) {
      if (error.message.includes("authentication") || error.message.includes("Unauthorized")) {
        return NextResponse.json(
          { error: "Invalid Replicate API token", details: errorMessage },
          { status: 401 }
        );
      }
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later.", details: errorMessage },
          { status: 429 }
        );
      }
      // Handle Vercel Blob errors
      if (error.message.includes("BLOB_READ_WRITE_TOKEN") || error.message.includes("blob")) {
        return NextResponse.json(
          { 
            error: "Blob storage error", 
            details: errorMessage,
            setup: "Make sure BLOB_READ_WRITE_TOKEN is set in your Vercel environment variables"
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: "Failed to process image", 
        details: errorMessage,
        hint: "Check Vercel function logs for more details"
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Image to 3D Processing API",
    endpoints: {
      POST: "Upload an image to convert to 3D",
    },
    requirements: {
      REPLICATE_API_TOKEN: "Required - Get from https://replicate.com/account/api-tokens",
      BLOB_READ_WRITE_TOKEN: "Required for Vercel Blob storage",
    },
  });
}
