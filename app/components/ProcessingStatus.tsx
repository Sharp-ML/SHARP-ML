"use client";

import { motion } from "framer-motion";
import { Cpu, Sparkles, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface ProcessingStatusProps {
  status: "uploading" | "processing" | "generating" | "complete" | "error";
  progress?: number;
  errorMessage?: string;
}

const stages = [
  {
    id: "uploading",
    label: "Uploading Image",
    description: "Transferring your image to the server",
    icon: Loader2,
  },
  {
    id: "processing",
    label: "Analyzing Scene",
    description: "Running neural network inference",
    icon: Cpu,
  },
  {
    id: "generating",
    label: "Generating 3D Gaussians",
    description: "Creating photorealistic 3D representation",
    icon: Sparkles,
  },
  {
    id: "complete",
    label: "Complete",
    description: "Your 3D scene is ready to explore",
    icon: CheckCircle2,
  },
];

export default function ProcessingStatus({
  status,
  progress = 0,
  errorMessage,
}: ProcessingStatusProps) {
  const currentIndex = stages.findIndex((s) => s.id === status);

  if (status === "error") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card border-[var(--error)]/20"
      >
        <div className="flex items-center gap-4">
          <div className="icon-box bg-[var(--error)]/10 border-[var(--error)]/20">
            <AlertCircle className="w-5 h-5 text-[var(--error)]" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--error)]">Processing Error</h3>
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
          <span className="text-sm font-medium">
            {stages[currentIndex]?.label || "Processing..."}
          </span>
          <span className="text-sm text-[var(--text-muted)]">{progress}%</span>
        </div>
        <div className="h-2 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[var(--foreground)] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-3">
        {stages.map((stage, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const Icon = stage.icon;

          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                isCurrent
                  ? "bg-[var(--warm-tint)] border border-[var(--border)]"
                  : isComplete
                    ? "opacity-70"
                    : "opacity-40"
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
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-[var(--success)]" strokeWidth={1.5} />
                ) : isCurrent ? (
                  <Icon
                    className={`w-5 h-5 text-white ${
                      stage.id !== "complete" ? "animate-spin" : ""
                    }`}
                    strokeWidth={1.5}
                  />
                ) : (
                  <Icon className="w-5 h-5 text-[var(--text-muted)]" strokeWidth={1.5} />
                )}
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
                  {stage.label}
                </p>
                {(isCurrent || isComplete) && (
                  <p className="text-sm text-[var(--text-muted)] truncate">
                    {stage.description}
                  </p>
                )}
              </div>

              {isCurrent && status !== "complete" && (
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
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
