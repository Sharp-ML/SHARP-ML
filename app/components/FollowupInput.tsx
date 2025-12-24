"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";

interface FollowupInputProps {
  onSubmit: (followup: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

// Format seconds to "Xm Ys" or "Xs" with tabular-nums styling
function FormattedTime({ seconds }: { seconds: number }) {
  if (seconds < 60) {
    return <><span className="tabular-nums">{seconds}</span>s</>;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return <><span className="tabular-nums">{mins}</span>m <span className="tabular-nums">{secs}</span>s</>;
}

export default function FollowupInput({
  onSubmit,
  isLoading = false,
  disabled = false,
}: FollowupInputProps) {
  const [followup, setFollowup] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start/stop timer based on loading state
  useEffect(() => {
    if (isLoading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedSeconds(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLoading]);

  const handleSubmit = () => {
    if (disabled || isLoading) return;
    if (followup.trim()) {
      onSubmit(followup.trim());
      setFollowup(""); // Clear input after submit
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = disabled || isLoading;
  const canSubmit = followup.trim().length > 0 && !isDisabled;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="w-full mt-4"
    >
      <div className="relative w-full">
        <input
          type="text"
          value={followup}
          onChange={(e) => setFollowup(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? "Regenerating..." : "Refine your scene..."}
          disabled={isDisabled}
          className="w-full h-12 px-4 pr-14 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/20 focus:border-[var(--foreground)]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        />
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all"
          aria-label="Regenerate scene"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
          ) : (
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          )}
        </button>
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-2 px-1">
        {isLoading 
          ? <>Regenerating • <FormattedTime seconds={elapsedSeconds} /> elapsed</>
          : "Describe changes to regenerate the 3D scene"
        }
      </p>
    </motion.div>
  );
}
