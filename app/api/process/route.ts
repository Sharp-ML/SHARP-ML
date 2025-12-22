import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Route segment config for App Router
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for model inference

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
    const modalEndpointUrl = process.env.MODAL_ENDPOINT_URL;
    const localDev = isLocalDev();
    
    if (!modalEndpointUrl) {
      return NextResponse.json(
        {
          error: "Server configuration error",
          message: "MODAL_ENDPOINT_URL is not configured. Please deploy the Sharp model to Modal and add the endpoint URL.",
          setup: {
            step1: "Install Modal CLI: pip install modal",
            step2: "Authenticate: modal token new",
            step3: "Deploy: cd modal && modal deploy sharp_api.py",
            step4: "Copy the web endpoint URL and add as MODAL_ENDPOINT_URL",
            step5: "Redeploy your application",
          },
        },
        { status: 500 }
      );
    }

    // Generate unique ID for this upload
    const id = generateId();
    const ext = file.name.split(".").pop() || "jpg";
    
    // Convert image to base64 for the Modal API call
    const imageBuffer = await file.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    
    let imageUrl: string;
    
    if (localDev) {
      // Local development: save to public folder
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      const inputFileName = `${id}.${ext}`;
      const inputFilePath = path.join(uploadsDir, inputFileName);
      await writeFile(inputFilePath, Buffer.from(imageBuffer));
      imageUrl = `/uploads/${inputFileName}`;
      console.log("Local dev: saved image to", inputFilePath);
    } else {
      // Production: upload to Vercel Blob
      const inputFileName = `uploads/${id}.${ext}`;
      const blob = await put(inputFileName, file, {
        access: "public",
      });
      imageUrl = blob.url;
    }

    // Call the Apple Sharp model via Modal endpoint
    // The model generates 3D Gaussian splats (PLY format) from a single image
    console.log("Calling Modal endpoint for Sharp inference...");
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0cc515e6-1119-40ab-a6a6-8f24cbdb1983',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:94',message:'Calling Modal endpoint',data:{endpoint:modalEndpointUrl,imageSize:imageBase64.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const response = await fetch(modalEndpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imageBase64,
      }),
    });

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0cc515e6-1119-40ab-a6a6-8f24cbdb1983',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:108',message:'Modal response received',data:{status:response.status,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Modal endpoint error:", errorText);
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0cc515e6-1119-40ab-a6a6-8f24cbdb1983',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:116',message:'Modal error response',data:{status:response.status,errorText:errorText.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      if (response.status === 503 || response.status === 502) {
        return NextResponse.json(
          { 
            error: "Model is loading", 
            details: "The Sharp model container is warming up. Please try again in 30-60 seconds.",
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: "3D generation failed", details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0cc515e6-1119-40ab-a6a6-8f24cbdb1983',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:140',message:'Modal result parsed',data:{success:result.success,hasError:!!result.error,hasPly:!!result.ply_base64},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (!result.success) {
      console.error("Sharp generation failed:", result.error);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0cc515e6-1119-40ab-a6a6-8f24cbdb1983',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:148',message:'Sharp generation failed',data:{error:result.error},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: "3D generation failed", details: result.error },
        { status: 500 }
      );
    }

    // Decode the PLY data from base64
    const plyBase64 = result.ply_base64;
    if (!plyBase64) {
      return NextResponse.json(
        { error: "3D generation failed - no PLY data received" },
        { status: 500 }
      );
    }

    const plyBuffer = Buffer.from(plyBase64, "base64");
    
    let modelUrl: string;

    if (localDev) {
      // Local development: save to public folder
      const outputsDir = path.join(process.cwd(), "public", "outputs");
      if (!existsSync(outputsDir)) {
        await mkdir(outputsDir, { recursive: true });
      }
      const modelFileName = `${id}.ply`;
      const modelFilePath = path.join(outputsDir, modelFileName);
      await writeFile(modelFilePath, plyBuffer);
      modelUrl = `/outputs/${modelFileName}`;
      console.log("Local dev: saved PLY to", modelFilePath);
    } else {
      // Production: upload to Vercel Blob
      const modelFileName = `outputs/${id}.ply`;
      const modelBlob = await put(modelFileName, new Blob([plyBuffer]), {
        access: "public",
        contentType: "application/x-ply",
      });
      modelUrl = modelBlob.url;
      console.log("Successfully uploaded PLY to Vercel Blob:", modelUrl);
    }

    console.log("Successfully generated 3D Gaussian splats:", modelUrl);

    return NextResponse.json({
      success: true,
      modelUrl: modelUrl,
      imageUrl: imageUrl,
      modelType: "ply",
      message: "3D Gaussian splats generated successfully using Apple Sharp",
    });
  } catch (error) {
    console.error("Processing error:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        return NextResponse.json(
          { 
            error: "Cannot connect to Modal endpoint", 
            details: "The Modal endpoint may be down or the URL is incorrect.",
            hint: "Check that your MODAL_ENDPOINT_URL is correct and the Modal app is deployed."
          },
          { status: 503 }
        );
      }
      if (error.message.includes("timeout") || error.message.includes("ETIMEDOUT")) {
        return NextResponse.json(
          { 
            error: "Request timeout", 
            details: "The Sharp model took too long to respond. This may happen on first request when the container is cold.",
            hint: "Try again - subsequent requests should be faster."
          },
          { status: 504 }
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
    message: "Apple Sharp - Image to 3D Gaussian Splats API",
    model: "apple/Sharp (via Modal)",
    endpoints: {
      POST: "Upload an image to convert to 3D Gaussian splats",
    },
    requirements: {
      MODAL_ENDPOINT_URL: "Required - Your deployed Modal endpoint URL",
      BLOB_READ_WRITE_TOKEN: "Required for Vercel Blob storage",
    },
    setup: {
      step1: "Install Modal CLI: pip install modal",
      step2: "Authenticate: modal token new",
      step3: "Deploy: cd modal && modal deploy sharp_api.py",
      step4: "Copy the web endpoint URL (ends with /generate)",
      step5: "Add MODAL_ENDPOINT_URL to your environment variables",
    },
  });
}
