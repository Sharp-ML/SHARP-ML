"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface PixelatedImageProps {
  src: string;
  alt: string;
  className?: string;
}

// Pixel levels from most blocky to full resolution
const PIXEL_LEVELS = [4, 8, 16, 32, 64, 128, 256];
const STEP_DURATION = 200; // ms per step

interface EdgeColors {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export default function PixelatedImage({
  src,
  alt,
  className = "",
}: PixelatedImageProps) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [pixelatedImages, setPixelatedImages] = useState<string[]>([]);
  const [edgeColors, setEdgeColors] = useState<EdgeColors | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorCanvasRef = useRef<HTMLCanvasElement>(null);

  // Extract edge colors from the image
  const extractEdgeColors = useCallback((img: HTMLImageElement) => {
    const canvas = colorCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Use a small canvas for sampling
    const sampleSize = 50;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

    const getAverageColor = (
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      const imageData = ctx.getImageData(x, y, width, height);
      const data = imageData.data;
      let r = 0,
        g = 0,
        b = 0,
        count = 0;

      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }

      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      return `rgb(${r}, ${g}, ${b})`;
    };

    // Sample edges - 5px strips
    const edgeWidth = 5;
    setEdgeColors({
      top: getAverageColor(0, 0, sampleSize, edgeWidth),
      bottom: getAverageColor(0, sampleSize - edgeWidth, sampleSize, edgeWidth),
      left: getAverageColor(0, 0, edgeWidth, sampleSize),
      right: getAverageColor(sampleSize - edgeWidth, 0, edgeWidth, sampleSize),
    });
  }, []);

  // Generate pixelated versions of the image
  const generatePixelatedVersions = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const versions: string[] = [];

    // Generate each pixelated version
    PIXEL_LEVELS.forEach((size) => {
      // Calculate aspect ratio preserving dimensions
      const aspectRatio = img.width / img.height;
      let width = size;
      let height = size;

      if (aspectRatio > 1) {
        height = Math.round(size / aspectRatio);
      } else {
        width = Math.round(size * aspectRatio);
      }

      // Ensure minimum dimensions
      width = Math.max(width, 1);
      height = Math.max(height, 1);

      // Set canvas to tiny size
      canvas.width = width;
      canvas.height = height;

      // Disable smoothing for pixelated effect
      ctx.imageSmoothingEnabled = false;

      // Draw tiny version
      ctx.drawImage(img, 0, 0, width, height);

      // Export as data URL
      versions.push(canvas.toDataURL("image/png"));
    });

    setPixelatedImages(versions);
  }, []);

  // Load the original image and generate pixelated versions
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      extractEdgeColors(img);
      generatePixelatedVersions(img);
    };

    img.src = src;

    return () => {
      img.onload = null;
    };
  }, [src, generatePixelatedVersions, extractEdgeColors]);

  // Animate through pixel levels once images are ready
  useEffect(() => {
    if (pixelatedImages.length === 0) return;

    if (currentLevel < PIXEL_LEVELS.length) {
      const timer = setTimeout(() => {
        setCurrentLevel((prev) => prev + 1);
      }, STEP_DURATION);

      return () => clearTimeout(timer);
    }
  }, [currentLevel, pixelatedImages.length]);

  // Reset when src changes
  useEffect(() => {
    setCurrentLevel(0);
    setPixelatedImages([]);
    setEdgeColors(null);
  }, [src]);

  const showOriginal = currentLevel >= PIXEL_LEVELS.length;

  // Get the current image to display - use the highest available level up to currentLevel
  const displayImage =
    pixelatedImages[Math.min(currentLevel, pixelatedImages.length - 1)];

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Hidden canvases for processing */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={colorCanvasRef} className="hidden" />

      {/* Current pixelated level - always show if available */}
      {displayImage && !showOriginal && (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage}
            alt={alt}
            className="w-full h-full object-cover"
            style={{
              imageRendering: "pixelated",
            }}
          />
        </div>
      )}

      {/* Final high-res image */}
      <div
        className={`absolute inset-0 transition-opacity duration-150 ${
          showOriginal ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      </div>

      {/* Gradient blur edges */}
      {edgeColors && (
        <>
          <div
            className="absolute inset-x-0 top-0 h-8 pointer-events-none"
            style={{
              background: `linear-gradient(to bottom, ${edgeColors.top}, transparent)`,
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-8 pointer-events-none"
            style={{
              background: `linear-gradient(to top, ${edgeColors.bottom}, transparent)`,
            }}
          />
          <div
            className="absolute inset-y-0 left-0 w-8 pointer-events-none"
            style={{
              background: `linear-gradient(to right, ${edgeColors.left}, transparent)`,
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-8 pointer-events-none"
            style={{
              background: `linear-gradient(to left, ${edgeColors.right}, transparent)`,
            }}
          />
        </>
      )}
    </div>
  );
}
