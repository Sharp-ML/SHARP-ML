"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Image as ImageIcon, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  disabled?: boolean;
}

export default function ImageUpload({
  onImageSelect,
  disabled,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
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
    [onImageSelect, disabled]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    maxFiles: 1,
    disabled,
  });

  const clearPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    setFileName(null);
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
              <div className="relative w-full max-w-md mx-auto aspect-[4/3] rounded-xl overflow-hidden border border-[var(--border)]">
                <Image
                  src={preview}
                  alt="Preview"
                  fill
                  className="object-cover"
                  unoptimized
                />

                {!disabled && (
                  <button
                    onClick={clearPreview}
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white transition-all border border-[var(--border)] shadow-sm hover:scale-105"
                  >
                    <X className="w-4 h-4 text-[var(--foreground)]" strokeWidth={1.5} />
                  </button>
                )}

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <ImageIcon className="w-4 h-4" strokeWidth={1.5} />
                    <span className="truncate">{fileName}</span>
                  </div>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-6 flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]"
              >
                <span>Processing will begin automatically</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6"
            >
              <motion.div
                animate={isDragActive ? { scale: 1.05 } : {}}
                transition={{ duration: 0.15 }}
                className="relative"
              >
                <div className="icon-box">
                  <Upload className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                </div>
              </motion.div>

              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">
                  {isDragActive ? "Drop your image here" : "Upload an image"}
                </h3>
                <p className="text-[var(--text-muted)] text-sm max-w-sm leading-relaxed">
                  Drag and drop or click to select a photo. We&apos;ll transform
                  it into an interactive 3D scene.
                </p>
              </div>

              <div className="flex items-center gap-6 text-sm text-[var(--text-muted)]">
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                  PNG, JPG, WEBP
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                  Max 10MB
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
