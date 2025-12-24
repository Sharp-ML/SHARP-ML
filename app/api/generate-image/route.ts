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

// Hidden system prompt optimized for Gaussian splat 3D reconstruction
const DEPTH_SYSTEM_PROMPT = `Generate an image optimized for 3D reconstruction. This image will be converted into an interactive 3D scene that users can orbit around, zoom into, and explore from any angle.

COMPOSITION (critical for 3D viewer):
- Center the main subject in the frame with breathing room around all edges
- Show the complete subject - never crop or cut off parts of the scene
- Design a scene that looks coherent from all viewing angles (imagine orbiting 360° around it)
- Slight 3/4 overhead angle works best for depth perception

DEPTH & STRUCTURE:
- Create clear separation between foreground, middle ground, and background elements
- Include objects at varying distances to establish strong depth
- Avoid large flat surfaces directly facing the camera
- Add overlapping elements to reinforce spatial relationships

MATERIALS & SURFACES:
- Prefer solid, opaque materials with rich surface detail and texture
- Include fine details that reward close inspection (users can zoom in very close)
- Matte and semi-matte surfaces work best

LIGHTING:
- Soft, diffused lighting (like overcast daylight or soft studio lighting)
- Avoid harsh directional shadows that create depth ambiguity
- Even illumination across the scene

MUST AVOID (these break 3D reconstruction):
- Text, signs, logos, watermarks, or writing of any kind
- Transparent materials: glass, water, ice, windows
- Highly reflective surfaces: mirrors, chrome, polished metal
- Volumetric effects: smoke, fog, fire, clouds, particles
- Motion blur or depth-of-field blur
- Over-saturated or neon colors
- Heavy HDR look or artificial glow effects

Generate the scene as: `;

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
          setup: {
            step1: "Go to Google AI Studio: https://aistudio.google.com/apikey",
            step2: "Create a new API key",
            step3: "Add GEMINI_API_KEY to your environment variables",
          },
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Invalid request", message: "A prompt is required" },
        { status: 400 }
      );
    }

    // Initialize Gemini client
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // Combine system prompt with user prompt for optimal 3D output
    const fullPrompt = DEPTH_SYSTEM_PROMPT + prompt.trim();

    console.log("Generating image with Gemini...");

    // Generate image using Gemini's image generation model
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ 
        role: "user",
        parts: [{ text: fullPrompt }]
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
        { error: "Image generation failed", message: "No image was generated" },
        { status: 500 }
      );
    }

    // Find the image part in the response
    let imageData: string | null = null;
    let mimeType = "image/png";

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageData) {
      console.error("No image data in Gemini response");
      return NextResponse.json(
        { error: "Image generation failed", message: "No image data received" },
        { status: 500 }
      );
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageData, "base64");
    
    // Generate unique ID for this image
    const id = generateId();
    const ext = mimeType.includes("png") ? "png" : "jpg";
    
    let imageUrl: string;
    const localDev = isLocalDev();

    if (localDev) {
      // Local development: save to public folder
      const uploadsDir = path.join(process.cwd(), "public", "generated");
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      const fileName = `${id}.${ext}`;
      const filePath = path.join(uploadsDir, fileName);
      await writeFile(filePath, imageBuffer);
      imageUrl = `/generated/${fileName}`;
      console.log("Local dev: saved generated image to", filePath);
    } else {
      // Production: upload to Vercel Blob
      const fileName = `generated/${id}.${ext}`;
      const blob = await put(fileName, imageBuffer, {
        access: "public",
        contentType: mimeType,
      });
      imageUrl = blob.url;
      console.log("Uploaded generated image to Vercel Blob:", imageUrl);
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      prompt: prompt.trim(),
    });
  } catch (error) {
    console.error("Image generation error:", error);

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
        error: "Image generation failed", 
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Image Generation API - Powered by Gemini",
    endpoints: {
      POST: "Generate an image from a text prompt (requires authentication)",
    },
    parameters: {
      prompt: "Text description of the image to generate",
    },
  });
}
