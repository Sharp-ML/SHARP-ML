"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Paperclip, X } from "lucide-react";
import Image from "next/image";

// 4.5MB limit to stay safely under Vercel's serverless function limit
const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

// Short chip labels for UI display, with full prompts for generation (naturalistic aesthetic)
const PROMPT_CHIPS = [
  {
    label: "Barbie dollhouse",
    prompt:
      "A tiny Barbie dreamhouse diorama with pastel pink walls, miniature velvet furniture, soft window light falling across the rooms, handcrafted dollhouse scale",
  },
  {
    label: "Santa's sleigh",
    prompt:
      "Santa's sleigh flying through a quiet snowy night, soft moonlight on fresh snow, paper craft style aurora in pale greens, felt reindeer, peaceful winter stillness",
  },
  {
    label: "F1 Monaco",
    prompt:
      "A vintage Formula 1 car on Monaco's harbor circuit, Mediterranean afternoon light, muted teal water in the marina, warm asphalt tones, 1970s racing photography feel",
  },
  {
    label: "Zen garden",
    prompt:
      "A Japanese zen garden in soft morning light, raked sand patterns, weathered stones with moss, a small maple tree with faded red leaves, tranquil and minimal",
  },
  {
    label: "Pirate battle",
    prompt:
      "Two wooden sailing ships in rough seas, overcast stormy light, tattered canvas sails, sea spray and mist, muted grays and browns like an old maritime painting",
  },
  {
    label: "Hobbit hole",
    prompt:
      "A cozy hobbit hole built into a grassy hillside, round wooden door, warm lamplight in small windows, overgrown garden with wildflowers, quiet evening atmosphere",
  },
  {
    label: "Cyberpunk market",
    prompt:
      "A narrow night market alley with rain-wet streets, soft neon signs in pink and blue, steam from food stalls, umbrellas and puddles, moody urban atmosphere",
  },
  {
    label: "Dragon's cave",
    prompt:
      "A dragon's treasure hoard in a dim cavern, scattered gold coins and old artifacts, a shaft of daylight from above, dust floating in the air, warm earth tones",
  },
  {
    label: "Fairy forest",
    prompt:
      "A quiet forest clearing at dusk, tiny glowing mushrooms, fireflies as small points of light, old mossy trees, soft mist low to the ground, muted greens and blues",
  },
  {
    label: "Retro arcade",
    prompt:
      "A 1980s arcade with rows of cabinet games, warm tungsten lighting mixed with soft screen glow, worn carpet, vintage posters, nostalgic and slightly faded",
  },
  {
    label: "Tropical island",
    prompt:
      "A small tropical beach with clear shallow water, a wooden dock, palm trees swaying gently, soft afternoon light, peaceful and uncrowded, natural muted colors",
  },
  {
    label: "Steampunk airship",
    prompt:
      "A brass and wood airship floating through clouds, soft diffused daylight, patina on metal surfaces, canvas balloon, Victorian details, like an antique photograph",
  },
];

interface AttachedImage {
  file: File;
  previewUrl: string;
  id: string;
}

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  onImageSelect?: (file: File) => void;
  disabled?: boolean;
  onDisabledClick?: () => void;
  onError?: (error: string) => void;
}

export default function PromptInput({
  onSubmit,
  onImageSelect,
  disabled,
  onDisabledClick,
  onError,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Randomly select chips to display
  const displayedChips = useMemo(() => {
    const shuffled = [...PROMPT_CHIPS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  }, []);

  const validateAndAddFile = useCallback(
    (file: File) => {
      // Validate file type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        onError?.("Invalid file type. Please use PNG, JPG, or WEBP.");
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        onError?.(`File too large (${sizeMB}MB). Maximum size is 4.5MB.`);
        return;
      }

      // Create preview URL and add to state
      const previewUrl = URL.createObjectURL(file);
      const newImage: AttachedImage = {
        file,
        previewUrl,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      setAttachedImages((prev) => [...prev, newImage]);
    },
    [onError],
  );

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      // Only take the first file for now (can be extended for multiple)
      validateAndAddFile(files[0]);
    },
    [validateAndAddFile],
  );

  const handleRemoveImage = useCallback((id: string) => {
    setAttachedImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const handleSubmit = () => {
    if (disabled) {
      onDisabledClick?.();
      return;
    }

    // If image attached without prompt, use image upload flow
    if (attachedImages.length > 0 && !prompt.trim()) {
      if (onImageSelect) {
        onImageSelect(attachedImages[0].file);
        // Clean up preview URLs
        attachedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
        setAttachedImages([]);
      }
      return;
    }

    // Otherwise, submit the prompt (TODO: could pass images as context in the future)
    if (prompt.trim()) {
      onSubmit(prompt.trim());
      // Clean up images after submit
      attachedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setAttachedImages([]);
    }
  };

  const handleChipClick = (chip: (typeof PROMPT_CHIPS)[0]) => {
    // Always allow selecting a chip to fill the prompt field
    setPrompt(chip.prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if dragging files
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files);
      }
    },
    [handleFileSelect],
  );

  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  const canSubmit = prompt.trim() || attachedImages.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div className="min-h-[265.5px] flex flex-col">
        <div className="flex flex-col gap-4 my-auto">
          {/* Textarea with attachment and submit buttons */}
          <div
            className={`relative w-full rounded-xl border bg-[var(--surface)] transition-all duration-200 ${
              isDragOver
                ? "border-[var(--foreground)]/40 border-dashed ring-2 ring-[var(--foreground)]/20"
                : "border-[var(--border)]"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                attachedImages.length > 0
                  ? "Add a prompt or submit to process image..."
                  : "Describe your 3D scene..."
              }
              style={{ scrollPaddingBlock: "1rem" }}
              className="w-full h-32 px-4 py-4 pr-24 bg-transparent text-[var(--foreground)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none text-base overflow-y-auto box-border border-none"
            />

            {/* Attached Images Thumbnails - Inside the input box */}
            {attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                {attachedImages.map((image) => (
                  <div key={image.id} className="relative group">
                    {/* Thumbnail - no border */}
                    <button
                      onClick={() => setModalImage(image.previewUrl)}
                      className="relative w-12 h-12 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <Image
                        src={image.previewUrl}
                        alt="Attached image"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </button>

                    {/* Remove button with cutout border */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(image.id);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center shadow-sm hover:scale-110 transition-transform cursor-pointer"
                      style={{
                        boxShadow: "0 0 0 2px var(--surface)",
                      }}
                      aria-label="Remove image"
                    >
                      <X className="w-3 h-3" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Drag overlay indicator */}
            <AnimatePresence>
              {isDragOver && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 rounded-xl bg-[var(--foreground)]/5 pointer-events-none flex items-center justify-center"
                >
                  <div className="flex items-center gap-2 text-[var(--foreground)]/60 font-medium">
                    <Paperclip className="w-5 h-5" strokeWidth={2} />
                    <span>Drop image here</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Buttons container */}
            <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
              {/* Paperclip button - hidden once an image is attached */}
              {attachedImages.length === 0 && (
                <button
                  onClick={handlePaperclipClick}
                  className="p-2.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] cursor-pointer transition-all"
                  aria-label="Attach image"
                  title="Attach an image"
                >
                  <Paperclip className="w-5 h-5" strokeWidth={2} />
                </button>
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="p-2.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all"
                aria-label="Generate 3D Scene"
              >
                <ArrowRight className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Example Chips */}
          <div className="flex flex-wrap gap-2">
            {displayedChips.map((chip, index) => (
              <motion.button
                key={chip.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  delay: index * 0.01,
                  duration: 0.2,
                }}
                onClick={() => handleChipClick(chip)}
                className="px-3 py-1.5 text-xs rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:bg-[var(--warm-tint)] hover:text-[var(--foreground)] transition-all whitespace-nowrap"
              >
                {chip.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      <AnimatePresence>
        {modalImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setModalImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-[90vw] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={modalImage}
                alt="Preview"
                width={800}
                height={600}
                className="object-contain max-w-[90vw] max-h-[90vh]"
                unoptimized
              />

              {/* Close button */}
              <button
                onClick={() => setModalImage(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
