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

export default function PixelatedImage({
  src,
  alt,
  className = "",
}: PixelatedImageProps) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [pixelatedImages, setPixelatedImages] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      generatePixelatedVersions(img);
    };

    img.src = src;

    return () => {
      img.onload = null;
    };
  }, [src, generatePixelatedVersions]);

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
  }, [src]);

  const showOriginal = currentLevel >= PIXEL_LEVELS.length;
  
  // Get the current image to display - use the highest available level up to currentLevel
  const displayImage = pixelatedImages[Math.min(currentLevel, pixelatedImages.length - 1)];

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Hidden canvas for generating pixelated versions */}
      <canvas ref={canvasRef} className="hidden" />

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
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
