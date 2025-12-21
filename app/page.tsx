"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  ArrowRight,
  Github,
  AlertCircle,
  Upload,
  Cpu,
  Move3D,
} from "lucide-react";
import ImageUpload from "./components/ImageUpload";
import GaussianViewer from "./components/GaussianViewer";
import ProcessingStatus from "./components/ProcessingStatus";

type AppState = "upload" | "processing" | "viewing" | "error";
type ProcessingStage =
  | "uploading"
  | "processing"
  | "generating"
  | "complete"
  | "error";

type ModelType = "ply" | "glb" | "gltf";

interface SetupInstructions {
  step1: string;
  step2: string;
  step3: string;
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [processingStage, setProcessingStage] =
    useState<ProcessingStage>("uploading");
  const [progress, setProgress] = useState(0);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelType, setModelType] = useState<ModelType>("glb");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfigError, setIsConfigError] = useState(false);
  const [setupInstructions, setSetupInstructions] =
    useState<SetupInstructions | null>(null);

  const handleImageSelect = useCallback(async (file: File) => {
    setAppState("processing");
    setProcessingStage("uploading");
    setProgress(0);
    setError(null);
    setIsConfigError(false);
    setSetupInstructions(null);

    // Create preview URL
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      // Initial upload progress
      setProgress(10);

      setProcessingStage("processing");

      // Upload the file
      const formData = new FormData();
      formData.append("image", file);

      setProgress(20);

      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      setProgress(30);

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a configuration error
        if (data.setup) {
          setIsConfigError(true);
          setSetupInstructions(data.setup);
          throw new Error(data.message || "Server configuration error");
        }
        throw new Error(data.error || "Processing failed");
      }

      // Show progress during processing (the API waits for completion)
      for (let i = 30; i <= 90; i += 10) {
        await new Promise((r) => setTimeout(r, 200));
        setProgress(i);
      }

      setProcessingStage("generating");
      setProgress(95);

      setProcessingStage("complete");
      setProgress(100);

      // Set the model URL and type from response
      setModelUrl(data.modelUrl);
      setModelType(data.modelType || "glb");

      // Wait a moment before showing the viewer
      await new Promise((r) => setTimeout(r, 500));
      setAppState("viewing");
    } catch (err) {
      console.error("Processing error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setProcessingStage("error");
      setAppState("error");
    }
  }, []);

  const handleReset = () => {
    setAppState("upload");
    setProcessingStage("uploading");
    setProgress(0);
    setModelUrl(null);
    setModelType("glb");
    setPreviewUrl(null);
    setError(null);
    setIsConfigError(false);
    setSetupInstructions(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main Content - no fixed header */}
      <main className="flex-1 pt-16 pb-8 px-6">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {appState === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Hero Section */}
                <div className="mb-10">
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight mb-1"
                  >
                    Image to 3D
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-base sm:text-lg text-[var(--text-muted)] leading-snug"
                  >
                    Transform any photo into an interactive 3D scene.
                  </motion.p>
                </div>

                {/* Upload Zone */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-10"
                >
                  <ImageUpload onImageSelect={handleImageSelect} />
                </motion.div>

                {/* How it works - GitHub-style cards */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-stretch gap-4">
                    {/* Card 1 */}
                    <div className="step-card flex-1">
                      <div className="step-card-icon">
                        <Upload className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <div className="step-card-title">Upload</div>
                      <div className="step-card-description">Drop any photo to get started.</div>
                    </div>

                    {/* Arrow 1 */}
                    <ArrowRight className="w-4 h-4 text-[var(--text-muted)] opacity-40 flex-shrink-0 self-center" strokeWidth={1.5} />

                    {/* Card 2 */}
                    <div className="step-card flex-1">
                      <div className="step-card-icon">
                        <Cpu className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <div className="step-card-title">Process</div>
                      <div className="step-card-description">AI analyzes depth and structure.</div>
                    </div>

                    {/* Arrow 2 */}
                    <ArrowRight className="w-4 h-4 text-[var(--text-muted)] opacity-40 flex-shrink-0 self-center" strokeWidth={1.5} />

                    {/* Card 3 */}
                    <div className="step-card flex-1">
                      <div className="step-card-icon">
                        <Move3D className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <div className="step-card-title">Explore</div>
                      <div className="step-card-description">Navigate your 3D scene.</div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {appState === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-xl mx-auto pt-16"
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-semibold mb-2">
                    Creating Your 3D Scene
                  </h2>
                  <p className="text-[var(--text-muted)]">
                    Analyzing your image and generating a 3D representation...
                  </p>
                </div>

                {/* Preview */}
                {previewUrl && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full max-w-sm mx-auto aspect-[4/3] rounded-2xl overflow-hidden border border-[var(--border)] mb-8 bg-[var(--surface)]"
                  >
                    <img
                      src={previewUrl}
                      alt="Processing"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full border-2 border-[var(--foreground)] border-t-transparent spin-slow" />
                    </div>
                  </motion.div>
                )}

                <ProcessingStatus
                  status={processingStage}
                  progress={progress}
                  errorMessage={error || undefined}
                />
              </motion.div>
            )}

            {appState === "viewing" && modelUrl && (
              <motion.div
                key="viewing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pt-8"
              >
                {/* Viewer header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold">Your 3D Scene</h2>
                    <p className="text-[var(--text-muted)] text-sm">
                      Drag to rotate • Scroll to zoom • Click and drag to pan
                    </p>
                  </div>
                  <button onClick={handleReset} className="btn-secondary">
                    New Image
                  </button>
                </div>

                {/* 3D Viewer */}
                <GaussianViewer
                  modelUrl={modelUrl}
                  modelType={modelType}
                  onReset={handleReset}
                />
              </motion.div>
            )}

            {appState === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-xl mx-auto pt-24"
              >
                <div className="text-center">
                  <div className="icon-box bg-[var(--error)]/10 border-[var(--error)]/20 mx-auto mb-6">
                    <AlertCircle className="w-6 h-6 text-[var(--error)]" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">
                    {isConfigError ? "Configuration Required" : "Processing Failed"}
                  </h2>
                  <p className="text-[var(--text-muted)] mb-6">
                    {error || "Something went wrong while processing your image."}
                  </p>
                </div>

                {/* Setup instructions for config errors */}
                {isConfigError && setupInstructions && (
                  <div className="bg-[var(--surface-elevated)] rounded-xl p-6 border border-[var(--border)] mb-8 text-left">
                    <h3 className="font-semibold mb-4">Setup Instructions</h3>
                    <div className="space-y-3 font-mono text-sm">
                      <div className="flex gap-3">
                        <span className="text-[var(--text-muted)]">1.</span>
                        <span>{setupInstructions.step1}</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-[var(--text-muted)]">2.</span>
                        <span>{setupInstructions.step2}</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-[var(--text-muted)]">3.</span>
                        <span>{setupInstructions.step3}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-center">
                  <button onClick={handleReset} className="btn-primary">
                    <span>Try Again</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer - Clean and minimal like ConnectKit */}
      <footer className="py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} />
            <span className="text-sm text-[var(--text-muted)]">
              Powered by{" "}
              <a
                href="https://github.com/apple/ml-sharp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--foreground)] hover:underline"
              >
                Apple ml-sharp
              </a>
            </span>
          </div>
          <div className="flex items-center gap-8 text-sm">
            <a
              href="https://arxiv.org/abs/2512.10685"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Paper
            </a>
            <a
              href="https://apple.github.io/ml-sharp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Project
            </a>
            <a
              href="https://github.com/apple/ml-sharp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link flex items-center gap-2"
            >
              <Github className="w-4 h-4" strokeWidth={1.5} />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
