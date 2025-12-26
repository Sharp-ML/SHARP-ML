"use client";

import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { ImageIcon } from "@/components/ui/image";
import { CpuIcon } from "@/components/ui/cpu";
import { SparklesIcon } from "@/components/ui/sparkles";
import { CircleCheckIcon } from "@/components/ui/circle-check";

interface ProcessingStatusProps {
  status: "uploading" | "processing" | "generating" | "complete" | "error";
  progress?: number;
  errorMessage?: string;
  stageProgress?: number; // 0-100 progress within the current stage
  mode?: "upload" | "prompt"; // Whether user uploaded an image or used a prompt
}

type StageId = "uploading" | "processing" | "generating" | "complete";

interface Stage {
  id: StageId;
  label: string;
  labelComplete: string;
  description: string;
  descriptionComplete: string;
  estimatedSeconds: number; // Base estimate for this stage
  showTimeEstimate: boolean; // Whether to show time estimate for this stage
}

// Get stages based on mode
function getStages(mode: "upload" | "prompt"): Stage[] {
  const isPrompt = mode === "prompt";

  return [
    {
      id: "uploading",
      label: isPrompt ? "Generating Image" : "Uploading Image",
      labelComplete: isPrompt ? "Generated" : "Uploaded",
      description: isPrompt
        ? "Creating image from your prompt"
        : "Transferring your image to the server",
      descriptionComplete: isPrompt
        ? "Image generated from prompt"
        : "Image transferred to server",
      estimatedSeconds: isPrompt ? 8 : 5,
      showTimeEstimate: false, // Don't show time for this quick initial stage
    },
    {
      id: "processing",
      label: "Analyzing Scene",
      labelComplete: "Analyzed",
      description: "Running neural network inference",
      descriptionComplete: "Neural network inference complete",
      estimatedSeconds: 60,
      showTimeEstimate: true,
    },
    {
      id: "generating",
      label: "Generating 3D",
      labelComplete: "Generated",
      description: "Creating 3D representation",
      descriptionComplete: "3D representation created",
      estimatedSeconds: 10,
      showTimeEstimate: true,
    },
    {
      id: "complete",
      label: "Complete",
      labelComplete: "Complete",
      description: "Your 3D scene is ready to explore",
      descriptionComplete: "Your 3D scene is ready to explore",
      estimatedSeconds: 0,
      showTimeEstimate: false,
    },
  ];
}

// Get icon for current stage
function StageIcon({
  stageId,
  isComplete,
  isAnimating,
  className = "",
}: {
  stageId: StageId;
  isComplete: boolean;
  isAnimating: boolean;
  className?: string;
}) {
  if (isComplete) {
    return (
      <CircleCheckIcon
        size={20}
        className={`text-[var(--success)] ${className}`}
        isAnimating={true}
      />
    );
  }

  const iconClassName = `text-[var(--text-secondary)] ${className}`;

  switch (stageId) {
    case "uploading":
      return (
        <ImageIcon
          size={20}
          className={iconClassName}
          isAnimating={isAnimating}
        />
      );
    case "processing":
      return (
        <CpuIcon
          size={20}
          className={iconClassName}
          isAnimating={isAnimating}
        />
      );
    case "generating":
      return (
        <SparklesIcon
          size={20}
          className={iconClassName}
          isAnimating={isAnimating}
        />
      );
    case "complete":
      return (
        <CircleCheckIcon
          size={20}
          className={iconClassName}
          isAnimating={isAnimating}
        />
      );
    default:
      return null;
  }
}

export default function ProcessingStatus({
  status,
  progress = 0,
  errorMessage,
  stageProgress,
  mode = "upload",
}: ProcessingStatusProps) {
  const stages = getStages(mode);
  const currentIndex = stages.findIndex((s) => s.id === status);
  const currentStage = stages[currentIndex] || stages[0];
  const isComplete = status === "complete";

  // Calculate time remaining - only for stages that show it
  const getTimeRemaining = () => {
    if (isComplete) return null;
    if (!currentStage.showTimeEstimate) return null;

    // Use stageProgress if available (for the processing stage)
    if (stageProgress !== undefined && stageProgress > 0) {
      const remaining = Math.max(
        1,
        Math.round(
          ((100 - stageProgress) / 100) * currentStage.estimatedSeconds,
        ),
      );
      return remaining;
    }

    // Otherwise estimate based on overall progress for processing stage
    if (status === "processing") {
      const remaining = Math.max(
        1,
        Math.round(((100 - progress) / 100) * currentStage.estimatedSeconds),
      );
      return remaining;
    }

    return null;
  };

  const timeRemaining = getTimeRemaining();

  if (status === "error") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card border-[var(--error)]/20"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--error)]/10 border border-[var(--error)]/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle
              className="w-5 h-5 text-[var(--error)]"
              strokeWidth={1.5}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[var(--error)]">
              Processing Failed
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {errorMessage || "Something went wrong. Please try again."}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Calculate the effective progress (use stageProgress for more granular updates during processing)
  const effectiveProgress =
    stageProgress !== undefined && status === "processing"
      ? Math.round(20 + (stageProgress / 100) * 60) // Processing stage is roughly 20-80% of total
      : progress;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      {/* Consolidated progress row: icon + progress bar + info */}
      <div className="flex items-center gap-4">
        {/* Icon box */}
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors border ${
            isComplete
              ? "bg-[var(--success)]/10 border-[var(--success)]/20"
              : "bg-transparent border-[var(--border)]"
          }`}
        >
          <StageIcon
            stageId={currentStage.id}
            isComplete={isComplete}
            isAnimating={!isComplete}
          />
        </div>

        {/* Progress bar and text */}
        <div className="flex-1 min-w-0">
          {/* Label row */}
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`text-sm font-medium ${isComplete ? "text-[var(--success)]" : "text-[var(--foreground)]"}`}
            >
              {isComplete ? currentStage.labelComplete : currentStage.label}
            </span>
            <span className="text-sm text-[var(--text-muted)] tabular-nums">
              {effectiveProgress}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-[var(--surface-elevated)] rounded-full overflow-hidden mb-1.5">
            <motion.div
              className={`h-full rounded-full ${isComplete ? "bg-[var(--success)]" : "bg-[var(--foreground)]"}`}
              initial={{ width: 0 }}
              animate={{ width: `${effectiveProgress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          {/* Description and time estimate */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-muted)] truncate">
              {isComplete
                ? currentStage.descriptionComplete
                : currentStage.description}
            </p>
            {timeRemaining !== null && (
              <span className="text-xs text-[var(--text-muted)] tabular-nums flex-shrink-0 ml-2">
                {timeRemaining}s
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
