"use client";

import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { LayersIcon } from "@/components/ui/layers";
import { CpuIcon } from "@/components/ui/cpu";
import { SparklesIcon } from "@/components/ui/sparkles";
import { CircleCheckIcon } from "@/components/ui/circle-check";

interface ProcessingStatusProps {
  status: "uploading" | "processing" | "generating" | "complete" | "error";
  progress?: number;
  errorMessage?: string;
  stageProgress?: number; // 0-100 progress within the current stage
}

type StageId = "uploading" | "processing" | "generating" | "complete";

interface Stage {
  id: StageId;
  label: string;
  labelComplete: string;
  description: string;
}

const stages: Stage[] = [
  {
    id: "uploading",
    label: "Uploading Image",
    labelComplete: "Uploaded",
    description: "Transferring your image to the server",
  },
  {
    id: "processing",
    label: "Analyzing Scene",
    labelComplete: "Analyzed",
    description: "Running neural network inference",
  },
  {
    id: "generating",
    label: "Generating 3D Gaussians",
    labelComplete: "Generated",
    description: "Creating photorealistic 3D representation",
  },
  {
    id: "complete",
    label: "Complete",
    labelComplete: "Complete",
    description: "Your 3D scene is ready to explore",
  },
];

// Individual stage row component
function StageRow({ 
  stage, 
  index, 
  currentIndex, 
  status,
  stageProgress,
}: { 
  stage: Stage; 
  index: number; 
  currentIndex: number; 
  status: string;
  stageProgress?: number;
}) {
  const isComplete = index < currentIndex;
  const isCurrent = index === currentIndex;
  const shouldAnimate = isCurrent && status !== "complete";

  const renderIcon = () => {
    if (isComplete) {
      return (
        <CircleCheckIcon
          size={20}
          className="text-[var(--success)]"
          isAnimating={true}
        />
      );
    }

    const iconClassName = isCurrent ? "text-white" : "text-[var(--text-muted)]";

    switch (stage.id) {
      case "uploading":
        return (
          <LayersIcon
            size={20}
            className={iconClassName}
            isAnimating={shouldAnimate}
          />
        );
      case "processing":
        return (
          <CpuIcon
            size={20}
            className={iconClassName}
            isAnimating={shouldAnimate}
          />
        );
      case "generating":
        return (
          <SparklesIcon
            size={20}
            className={iconClassName}
            isAnimating={shouldAnimate}
          />
        );
      case "complete":
        return (
          <CircleCheckIcon
            size={20}
            className={iconClassName}
            isAnimating={isCurrent}
          />
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-center gap-4 p-4 rounded-xl transition-all border ${
        isCurrent
          ? "bg-[var(--warm-tint)] border-[var(--border)]"
          : isComplete
            ? "opacity-70 border-transparent"
            : "opacity-40 border-transparent"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
          isCurrent
            ? "bg-[var(--foreground)]"
            : isComplete
              ? "bg-[var(--success)]/10"
              : "bg-[var(--surface-elevated)] border border-[var(--border)]"
        }`}
      >
        {renderIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            isCurrent
              ? "text-[var(--foreground)]"
              : isComplete
                ? "text-[var(--success)]"
                : "text-[var(--text-muted)]"
          }`}
        >
          {isComplete ? stage.labelComplete : stage.label}
        </p>
        {(isCurrent || isComplete) && (
          <p className="text-sm text-[var(--text-muted)] truncate">
            {stage.description}
          </p>
        )}
        {/* Stage progress bar for processing stage */}
        {isCurrent && stageProgress !== undefined && stageProgress > 0 && status !== "complete" && (
          <div className="mt-2">
            <div className="h-1 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[var(--foreground)]/60"
                initial={{ width: 0 }}
                animate={{ width: `${stageProgress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              ~{Math.max(1, Math.round((100 - stageProgress) / 100 * 60))}s remaining
            </p>
          </div>
        )}
      </div>

      {isCurrent && status !== "complete" && stageProgress === undefined && (
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[var(--foreground)]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      )}
      {isCurrent && stageProgress !== undefined && stageProgress > 0 && status !== "complete" && (
        <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
          {Math.round(stageProgress)}%
        </span>
      )}
    </motion.div>
  );
}

export default function ProcessingStatus({
  status,
  progress = 0,
  errorMessage,
  stageProgress,
}: ProcessingStatusProps) {
  const currentIndex = stages.findIndex((s) => s.id === status);

  if (status === "error") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card border-[var(--error)]/20"
      >
        <div className="flex items-center gap-3">
          <div className="icon-box bg-[var(--error)]/10 border-[var(--error)]/20">
            <AlertCircle className="w-5 h-5 text-[var(--error)]" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--error)]">Processing Failed</h3>
            <p className="text-sm text-[var(--text-muted)]">
              {errorMessage || "Something went wrong. Please try again."}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-medium ${status === "complete" ? "text-[var(--success)]" : ""}`}>
            {status === "complete" ? stages[currentIndex]?.labelComplete : stages[currentIndex]?.label || "Processing..."}
          </span>
          <span className="text-sm text-[var(--text-muted)]">{progress}%</span>
        </div>
        <div className="h-2 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${status === "complete" ? "bg-[var(--success)]" : "bg-[var(--foreground)]"}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-3">
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={index}
            currentIndex={currentIndex}
            status={status}
            stageProgress={index === currentIndex ? stageProgress : undefined}
          />
        ))}
      </div>
    </motion.div>
  );
}
