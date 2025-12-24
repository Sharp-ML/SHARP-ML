import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { auth } from "@/lib/auth";

// Route segment config for App Router
export const runtime = "nodejs";
export const maxDuration = 60; // 1 minute for image generation

// System prompt for editing images while maintaining style consistency
const EDIT_SYSTEM_PROMPT = `You are an image editor. The user will provide an existing image and a description of changes they want.

Your task is to generate a NEW image that:
1. Maintains the EXACT same visual style, color palette, and artistic approach as the original
2. Keeps the same camera angle, perspective, and composition
3. Preserves the overall scene structure and layout
4. Incorporates the requested changes seamlessly into the existing scene

The output should look like a natural evolution of the original image, NOT a completely new scene.
Keep the miniature diorama aesthetic, lighting, and handcrafted feel consistent with the original.

Generate the modified scene based on this change request: `;

// Generate unique filename
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Check if we're in local development mode (no blob token)
function isLocalDev(): boolean {
  return !process.env.BLOB_READ_WRITE_TOKEN;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required", message: "Please sign in to continue" },
        { status: 401 }
      );
    }

    // Check for Gemini API key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      return NextResponse.json(
        {
          error: "Server configuration error",
          message: "GEMINI_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { imageUrl, editPrompt } = body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "Invalid request", message: "An image URL is required" },
        { status: 400 }
      );
    }

    if (!editPrompt || typeof editPrompt !== "string" || !editPrompt.trim()) {
      return NextResponse.json(
        { error: "Invalid request", message: "An edit prompt is required" },
        { status: 400 }
      );
    }

    // Fetch the existing image
    console.log("Fetching existing image for editing...");
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image", message: "Could not retrieve the existing image" },
        { status: 400 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    
    // Determine mime type from response or URL
    const contentType = imageResponse.headers.get("content-type") || "image/png";
    const mimeType = contentType.includes("jpeg") || contentType.includes("jpg") 
      ? "image/jpeg" 
      : "image/png";

    // Initialize Gemini client
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // Combine system prompt with user's edit request
    const fullPrompt = EDIT_SYSTEM_PROMPT + editPrompt.trim();

    console.log("Editing image with Gemini...");

    // Generate edited image using Gemini's multimodal capabilities
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [{ 
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64,
            },
          },
          { text: fullPrompt }
        ]
      }],
      config: {
        responseModalities: ["image", "text"],
      },
    });

    // Extract image from response
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      console.error("No content in Gemini response");
      return NextResponse.json(
        { error: "Image editing failed", message: "No image was generated" },
        { status: 500 }
      );
    }

    // Find the image part in the response
    let outputImageData: string | null = null;
    let outputMimeType = "image/png";

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        outputImageData = part.inlineData.data;
        outputMimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!outputImageData) {
      console.error("No image data in Gemini response");
      return NextResponse.json(
        { error: "Image editing failed", message: "No edited image data received" },
        { status: 500 }
      );
    }

    // Convert base64 to buffer
    const outputBuffer = Buffer.from(outputImageData, "base64");
    
    // Generate unique ID for this image
    const id = generateId();
    const ext = outputMimeType.includes("png") ? "png" : "jpg";
    
    let outputUrl: string;
    const localDev = isLocalDev();

    if (localDev) {
      // Local development: save to public folder
      const uploadsDir = path.join(process.cwd(), "public", "edited");
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      const fileName = `${id}.${ext}`;
      const filePath = path.join(uploadsDir, fileName);
      await writeFile(filePath, outputBuffer);
      outputUrl = `/edited/${fileName}`;
      console.log("Local dev: saved edited image to", filePath);
    } else {
      // Production: upload to Vercel Blob
      const fileName = `edited/${id}.${ext}`;
      const blob = await put(fileName, outputBuffer, {
        access: "public",
        contentType: outputMimeType,
      });
      outputUrl = blob.url;
      console.log("Uploaded edited image to Vercel Blob:", outputUrl);
    }

    return NextResponse.json({
      success: true,
      imageUrl: outputUrl,
      editPrompt: editPrompt.trim(),
    });
  } catch (error) {
    console.error("Image editing error:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle specific Gemini errors
    if (errorMessage.includes("API key")) {
      return NextResponse.json(
        { 
          error: "Invalid API key", 
          message: "The Gemini API key is invalid or expired.",
        },
        { status: 401 }
      );
    }

    if (errorMessage.includes("quota") || errorMessage.includes("rate")) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded", 
          message: "Too many requests. Please try again in a moment.",
        },
        { status: 429 }
      );
    }

    if (errorMessage.includes("safety") || errorMessage.includes("blocked")) {
      return NextResponse.json(
        { 
          error: "Content blocked", 
          message: "The prompt was blocked by safety filters. Please try a different prompt.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: "Image editing failed", 
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Image Editing API - Powered by Gemini",
    endpoints: {
      POST: "Edit an existing image based on a prompt (requires authentication)",
    },
    parameters: {
      imageUrl: "URL of the existing image to edit",
      editPrompt: "Description of the changes to make",
    },
  });
}
