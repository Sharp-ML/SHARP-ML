"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Short chip labels for UI display, with full prompts for generation (naturalistic aesthetic)
const PROMPT_CHIPS = [
  { label: "Barbie dollhouse", prompt: "A tiny Barbie dreamhouse diorama with pastel pink walls, miniature velvet furniture, soft window light falling across the rooms, handcrafted dollhouse scale" },
  { label: "Santa's sleigh", prompt: "Santa's sleigh flying through a quiet snowy night, soft moonlight on fresh snow, paper craft style aurora in pale greens, felt reindeer, peaceful winter stillness" },
  { label: "F1 Monaco", prompt: "A vintage Formula 1 car on Monaco's harbor circuit, Mediterranean afternoon light, muted teal water in the marina, warm asphalt tones, 1970s racing photography feel" },
  { label: "Zen garden", prompt: "A Japanese zen garden in soft morning light, raked sand patterns, weathered stones with moss, a small maple tree with faded red leaves, tranquil and minimal" },
  { label: "Pirate battle", prompt: "Two wooden sailing ships in rough seas, overcast stormy light, tattered canvas sails, sea spray and mist, muted grays and browns like an old maritime painting" },
  { label: "Hobbit hole", prompt: "A cozy hobbit hole built into a grassy hillside, round wooden door, warm lamplight in small windows, overgrown garden with wildflowers, quiet evening atmosphere" },
  { label: "Cyberpunk market", prompt: "A narrow night market alley with rain-wet streets, soft neon signs in pink and blue, steam from food stalls, umbrellas and puddles, moody urban atmosphere" },
  { label: "Dragon's cave", prompt: "A dragon's treasure hoard in a dim cavern, scattered gold coins and old artifacts, a shaft of daylight from above, dust floating in the air, warm earth tones" },
  { label: "Fairy forest", prompt: "A quiet forest clearing at dusk, tiny glowing mushrooms, fireflies as small points of light, old mossy trees, soft mist low to the ground, muted greens and blues" },
  { label: "Retro arcade", prompt: "A 1980s arcade with rows of cabinet games, warm tungsten lighting mixed with soft screen glow, worn carpet, vintage posters, nostalgic and slightly faded" },
  { label: "Tropical island", prompt: "A small tropical beach with clear shallow water, a wooden dock, palm trees swaying gently, soft afternoon light, peaceful and uncrowded, natural muted colors" },
  { label: "Steampunk airship", prompt: "A brass and wood airship floating through clouds, soft diffused daylight, patina on metal surfaces, canvas balloon, Victorian details, like an antique photograph" },
];

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  onDisabledClick?: () => void;
}

export default function PromptInput({
  onSubmit,
  disabled,
  onDisabledClick,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState("");

  // Randomly select chips to display
  const displayedChips = useMemo(() => {
    const shuffled = [...PROMPT_CHIPS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  }, []);

  const handleSubmit = () => {
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    if (prompt.trim()) {
      onSubmit(prompt.trim());
    }
  };

  const handleChipClick = (chip: typeof PROMPT_CHIPS[0]) => {
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    setPrompt(chip.prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div className={`min-h-[265.5px] flex flex-col ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
        <div className="flex flex-col gap-4 my-auto">
          {/* Textarea with submit button */}
          <div className="relative w-full">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your 3D scene..."
              disabled={disabled}
              style={{ scrollPaddingBlock: '1rem' }}
              className="w-full h-32 px-4 py-4 pr-16 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/20 focus:border-[var(--foreground)]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base overflow-y-auto box-border"
            />
            <button
              onClick={handleSubmit}
              disabled={disabled || !prompt.trim()}
              className="absolute right-2 bottom-4 p-2.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all"
              aria-label="Generate 3D Scene"
            >
              <ArrowRight className="w-5 h-5" strokeWidth={2} />
            </button>
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
                  duration: 0.2
                }}
                onClick={() => handleChipClick(chip)}
                disabled={disabled}
                className="px-3 py-1.5 text-xs rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:bg-[var(--warm-tint)] hover:text-[var(--foreground)] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {chip.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
