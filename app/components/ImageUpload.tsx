"use client";

import { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { UploadIcon } from "@/components/ui/upload";
import { XIcon } from "@/components/ui/x";
import { ArrowRightIcon } from "@/components/ui/arrow-right";
import { ImageIcon } from "@/components/ui/image";
import { motion, AnimatePresence } from "framer-motion";
import PixelatedImage from "./PixelatedImage";

// 4.5MB limit to stay safely under Vercel's serverless function limit
const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  disabled?: boolean;
  onDisabledClick?: () => void;
  onError?: (error: string) => void;
}

export default function ImageUpload({
  onImageSelect,
  disabled,
  onDisabledClick,
  onError,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setFileSizeError(null);
      
      // Handle rejected files first
      if (fileRejections.length > 0) {
        const rejection = fileRejections[0];
        const errorCode = rejection.errors[0]?.code;
        let error: string;
        
        if (errorCode === "file-too-large") {
          const sizeMB = (rejection.file.size / (1024 * 1024)).toFixed(1);
          error = `File too large (${sizeMB}MB). Maximum size is 4.5MB.`;
        } else if (errorCode === "file-invalid-type") {
          error = "Invalid file type. Please use PNG, JPG, or WEBP.";
        } else {
          error = rejection.errors[0]?.message || "File could not be uploaded.";
        }
        
        setFileSizeError(error);
        onError?.(error);
        return;
      }
      
      // Handle accepted files
      if (acceptedFiles.length > 0 && !disabled) {
        const file = acceptedFiles[0];
        
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        onImageSelect(file);
      }
    },
    [onImageSelect, disabled, onError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    disabled,
    noClick: disabled,
    noDrag: disabled,
  });

  // Handle click when disabled (to show upgrade modal)
  const handleDisabledClick = () => {
    if (disabled && onDisabledClick) {
      onDisabledClick();
    }
  };

  const clearPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    setFileName(null);
    setFileSizeError(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div
        {...getRootProps()}
        onClick={disabled ? handleDisabledClick : getRootProps().onClick}
        className={`upload-zone relative ${isDragActive ? "active" : ""} ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {preview ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative"
            >
              <div className="relative w-full max-w-xs sm:max-w-md mx-auto aspect-[4/3] rounded-lg sm:rounded-xl overflow-hidden border border-[var(--border)]">
                <PixelatedImage
                  src={preview}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full"
                />

                {!disabled && (
                  <button
                    onClick={clearPreview}
                    className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 rounded-full bg-white/90 hover:bg-white transition-all border border-[var(--border)] shadow-sm hover:scale-105"
                  >
                    <XIcon size={14} className="text-[var(--foreground)] sm:hidden" />
                    <XIcon size={16} className="text-[var(--foreground)] hidden sm:block" />
                  </button>
                )}

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 sm:p-4">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-white">
                    <ImageIcon size={14} className="sm:hidden" />
                    <ImageIcon size={16} className="hidden sm:block" />
                    <span className="truncate">{fileName}</span>
                  </div>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-4 sm:mt-6 flex items-center justify-center gap-2 text-xs sm:text-sm text-[var(--text-muted)]"
              >
                <span>Processing will begin automatically</span>
                <ArrowRightIcon size={14} className="sm:hidden" />
                <ArrowRightIcon size={16} className="hidden sm:block" />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 sm:gap-6"
            >
              <motion.div
                animate={isDragActive ? { scale: 1.05 } : {}}
                transition={{ duration: 0.15 }}
                className="relative"
              >
                <div className="icon-box">
                  <UploadIcon size={18} className="text-[var(--text-secondary)] sm:hidden" />
                  <UploadIcon size={20} className="text-[var(--text-secondary)] hidden sm:block" />
                </div>
              </motion.div>

              <div className="text-center">
                <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">
                  {isDragActive ? "Drop your image here" : "Upload an image"}
                </h3>
                <p className="text-[var(--text-muted)] text-xs sm:text-sm max-w-xs sm:max-w-sm leading-relaxed px-2">
                  Drag and drop or click to select a photo. We&apos;ll transform
                  it into an interactive 3D scene.
                </p>
              </div>

              <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[var(--success)]" />
                  PNG, JPG, WEBP
                </span>
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[var(--text-muted)]" />
                  Max 4.5MB
                </span>
              </div>

              {fileSizeError && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 sm:mt-4 px-3 sm:px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs sm:text-sm"
                >
                  {fileSizeError}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
