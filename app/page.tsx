"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  ArrowLeft,
  ArrowRight,
  Github,
  AlertCircle,
  Clock,
  Trash2,
  ChevronRight,
  Share2,
  Check,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import ImageUpload from "./components/ImageUpload";
import GaussianViewer from "./components/GaussianViewer";
import ProcessingStatus from "./components/ProcessingStatus";
import PixelatedImage from "./components/PixelatedImage";
import { useScenesHistory, SavedScene } from "./hooks/useScenesHistory";
import { AuthGate } from "./components/AuthGate";
import { signOut } from "next-auth/react";
import { UpgradeModal } from "./components/UpgradeModal";

const FREE_SCENE_LIMIT = 3;

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
  step4?: string;
}

interface UserUsage {
  sceneCount: number;
  isPaid: boolean;
  remainingUploads: number | null;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Wrapper component to handle Suspense boundary for useSearchParams
export default function Home() {
  return (
    <AuthGate>
      <Suspense fallback={<HomeLoading />}>
        <HomeContent />
      </Suspense>
    </AuthGate>
  );
}

// Loading state while search params are being parsed
function HomeLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-[var(--foreground)] border-t-transparent spin-slow" />
    </div>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update: updateSession } = useSession();
  
  const [appState, setAppState] = useState<AppState>("upload");
  const [processingStage, setProcessingStage] =
    useState<ProcessingStage>("uploading");
  const [progress, setProgress] = useState(0);
  const [stageProgress, setStageProgress] = useState<number | undefined>(undefined);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelType, setModelType] = useState<ModelType>("glb");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null); // Vercel Blob URL for sharing
  const [error, setError] = useState<string | null>(null);
  const [isConfigError, setIsConfigError] = useState(false);
  const [setupInstructions, setSetupInstructions] =
    useState<SetupInstructions | null>(null);
  const [currentSceneName, setCurrentSceneName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Usage tracking state
  const [userUsage, setUserUsage] = useState<UserUsage | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Scene history persistence
  const {
    scenes,
    isLoaded: historyLoaded,
    addScene,
    removeScene,
    clearAllScenes,
  } = useScenesHistory();

  // Ref to store the current file's data URL for saving
  const currentPreviewDataUrl = useRef<string | null>(null);
  // Ref to store the image URL from API for saving
  const currentImageUrl = useRef<string | null>(null);

  // Fetch user usage data on mount and after session changes
  useEffect(() => {
    async function fetchUsage() {
      if (!session?.user) return;
      
      try {
        const response = await fetch("/api/user");
        if (response.ok) {
          const data = await response.json();
          setUserUsage({
            sceneCount: data.sceneCount,
            isPaid: data.isPaid,
            remainingUploads: data.remainingUploads,
          });
        }
      } catch (error) {
        console.error("Failed to fetch user usage:", error);
      }
    }
    
    fetchUsage();
  }, [session]);

  // Check for payment success/cancelled in URL
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      // Refresh session and usage data
      updateSession();
      setUserUsage(prev => prev ? { ...prev, isPaid: true, remainingUploads: null } : null);
      // Clean up URL
      router.replace("/", { scroll: false });
    } else if (payment === "cancelled") {
      // Clean up URL
      router.replace("/", { scroll: false });
    }
  }, [searchParams, router, updateSession]);

  // Parse URL parameters on mount to load shared scene
  useEffect(() => {
    const model = searchParams.get("model");
    const type = searchParams.get("type") as ModelType | null;
    const name = searchParams.get("name");
    const preview = searchParams.get("preview");

    if (model) {
      setModelUrl(model);
      setModelType(type || "glb");
      setCurrentSceneName(name ? decodeURIComponent(name) : "Shared Scene");
      setPreviewUrl(preview || null);
      setImageUrl(preview || null);
      setAppState("viewing");
    }
  }, [searchParams]);

  // Update URL when viewing a scene
  const updateUrlForScene = useCallback((
    sceneModelUrl: string,
    sceneModelType: ModelType,
    sceneName: string | null,
    sceneImageUrl: string | null
  ) => {
    const params = new URLSearchParams();
    params.set("model", sceneModelUrl);
    params.set("type", sceneModelType);
    if (sceneName) {
      params.set("name", encodeURIComponent(sceneName));
    }
    if (sceneImageUrl) {
      params.set("preview", sceneImageUrl);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router]);

  // Copy share link to clipboard
  const handleShareScene = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  // Check if user can upload
  const canUpload = userUsage?.isPaid || (userUsage?.remainingUploads ?? FREE_SCENE_LIMIT) > 0;

  const handleImageSelect = useCallback(async (file: File) => {
    // Check if user can upload before proceeding
    if (!canUpload) {
      setShowUpgradeModal(true);
      return;
    }

    setAppState("processing");
    setProcessingStage("uploading");
    setProgress(0);
    setStageProgress(undefined);
    setError(null);
    setIsConfigError(false);
    setSetupInstructions(null);

    // Create preview URL
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    // Store the file name for later
    const fileName = file.name.replace(/\.[^/.]+$/, "") || "Scene";
    setCurrentSceneName(fileName);

    // Read file as data URL for saving to history
    const reader = new FileReader();
    reader.onload = () => {
      currentPreviewDataUrl.current = reader.result as string;
    };
    reader.readAsDataURL(file);

    // Progress interval reference for cleanup
    let progressInterval: NodeJS.Timeout | null = null;

    try {
      // Initial upload progress
      setProgress(10);

      setProcessingStage("processing");
      setStageProgress(0);

      // Upload the file
      const formData = new FormData();
      formData.append("image", file);

      setProgress(20);

      // Start progress estimation timer for the processing stage
      // The Sharp model typically takes 30-90 seconds
      const estimatedDuration = 60000; // 60 seconds expected
      const startTime = Date.now();
      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        // Use an easing curve that slows down as it approaches 95%
        // This creates a more realistic "waiting" feel
        const rawProgress = Math.min(95, (elapsed / estimatedDuration) * 100);
        // Apply easing: faster at start, slower as it approaches completion
        const easedProgress = rawProgress < 50 
          ? rawProgress 
          : 50 + (rawProgress - 50) * 0.5;
        setStageProgress(Math.min(95, easedProgress));
      }, 500);

      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      // Clear the progress timer
      clearInterval(progressInterval);
      progressInterval = null;
      setStageProgress(100);

      setProgress(30);

      // Handle 413 error specifically (file too large)
      if (response.status === 413) {
        throw new Error("File too large. Please use an image under 4.5MB.");
      }

      // Handle 401 (unauthorized)
      if (response.status === 401) {
        throw new Error("Please sign in to continue.");
      }

      // Handle 402 (payment required)
      if (response.status === 402) {
        setShowUpgradeModal(true);
        throw new Error("You've reached your free limit. Upgrade to continue.");
      }

      let data;
      try {
        data = await response.json();
      } catch {
        // If JSON parsing fails, it might be an error response
        throw new Error("Server error. Please try again with a smaller image.");
      }

      if (!response.ok) {
        // Check if it's a configuration error
        if (data.setup) {
          setIsConfigError(true);
          setSetupInstructions(data.setup);
          throw new Error(data.message || "Server configuration error");
        }
        // Check if payment is required
        if (data.requiresPayment) {
          setShowUpgradeModal(true);
        }
        // Include details in error message if available
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}` 
          : data.error || "Processing failed";
        throw new Error(errorMsg);
      }

      // Clear stage progress as we move to the next stage
      setStageProgress(undefined);

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
      const newModelUrl = data.modelUrl;
      const newModelType = data.modelType || "glb";
      const newImageUrl = data.imageUrl || null;
      setModelUrl(newModelUrl);
      setModelType(newModelType);
      setImageUrl(newImageUrl);
      currentImageUrl.current = newImageUrl;

      // Update usage from response
      if (data.usage) {
        setUserUsage({
          sceneCount: data.usage.sceneCount,
          isPaid: data.usage.isPaid,
          remainingUploads: data.usage.remainingUploads,
        });
      }

      // Save to history if we have the preview data URL
      if (currentPreviewDataUrl.current) {
        addScene({
          name: fileName,
          previewUrl: currentPreviewDataUrl.current,
          imageUrl: newImageUrl, // Store Vercel Blob URL for sharing
          modelUrl: newModelUrl,
          modelType: newModelType,
        });
      }

      // Wait a moment before showing the viewer
      await new Promise((r) => setTimeout(r, 500));
      setAppState("viewing");
      
      // Update URL for sharing
      updateUrlForScene(newModelUrl, newModelType, fileName, newImageUrl);
    } catch (err) {
      // Ensure progress timer is cleaned up on error
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      console.error("Processing error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setProcessingStage("error");
      setAppState("error");
    }
  }, [addScene, updateUrlForScene, canUpload]);

  const handleReset = useCallback(() => {
    setAppState("upload");
    setProcessingStage("uploading");
    setProgress(0);
    setStageProgress(undefined);
    setModelUrl(null);
    setModelType("glb");
    setPreviewUrl(null);
    setImageUrl(null);
    setError(null);
    setIsConfigError(false);
    setSetupInstructions(null);
    setCurrentSceneName(null);
    currentPreviewDataUrl.current = null;
    currentImageUrl.current = null;
    // Clear URL parameters
    router.replace("/", { scroll: false });
  }, [router]);

  // Handler for selecting a scene from history
  const handleSelectScene = useCallback((scene: SavedScene) => {
    setModelUrl(scene.modelUrl);
    setModelType(scene.modelType);
    setPreviewUrl(scene.previewUrl);
    setImageUrl(scene.imageUrl || null);
    setCurrentSceneName(scene.name);
    setAppState("viewing");
    setError(null);
    setIsConfigError(false);
    // Update URL for sharing (use imageUrl for preview if available, else previewUrl if it's not base64)
    const shareablePreview = scene.imageUrl || (scene.previewUrl.startsWith("http") ? scene.previewUrl : null);
    updateUrlForScene(scene.modelUrl, scene.modelType, scene.name, shareablePreview);
  }, [updateUrlForScene]);

  // Debug controls - only show in development
  const isDev = process.env.NODE_ENV === "development";
  const [debugPanelHidden, setDebugPanelHidden] = useState(false);
  
  // Debug state for 3D viewer
  const [viewerDebugLoading, setViewerDebugLoading] = useState<boolean | number | undefined>(undefined);
  const [viewerDebugError, setViewerDebugError] = useState<boolean | string | undefined>(undefined);
  
  // Hover preview state for recent scenes
  const [hoveredSceneId, setHoveredSceneId] = useState<string | null>(null);

  const setDebugState = (
    state: AppState,
    stage?: ProcessingStage,
    prog?: number
  ) => {
    setAppState(state);
    if (stage) setProcessingStage(stage);
    if (prog !== undefined) setProgress(prog);
    if (state === "viewing") {
      setModelUrl("/outputs/sample.glb"); // Fake URL for preview
      setModelType("glb");
      // Start with loading state mocked so we can see the loading UI
      setViewerDebugLoading(50);
      setViewerDebugError(undefined);
    } else {
      // Reset viewer debug state when not viewing
      setViewerDebugLoading(undefined);
      setViewerDebugError(undefined);
    }
    if (state === "error") {
      setError("Sample error message for styling");
    }
    if (state === "processing") {
      setPreviewUrl("https://picsum.photos/400/300"); // Placeholder image
    }
  };

  const setDebugConfigError = () => {
    setAppState("error");
    setError("Replicate API token not configured");
    setIsConfigError(true);
    setSetupInstructions({
      step1: "Create a Replicate account at replicate.com",
      step2: "Get your API token from replicate.com/account",
      step3: "Add REPLICATE_API_TOKEN to your .env.local file",
    });
  };

  // Add mock scenes for debugging
  const addMockScenes = () => {
    const mockImages = [
      "https://picsum.photos/seed/scene1/400/300",
      "https://picsum.photos/seed/scene2/400/300",
      "https://picsum.photos/seed/scene3/400/300",
    ];
    const mockNames = ["Mountain Vista", "Ocean Sunset", "City Skyline"];
    
    mockNames.forEach((name, i) => {
      addScene({
        name,
        previewUrl: mockImages[i],
        modelUrl: `/outputs/mock-${i}.glb`,
        modelType: "glb",
      });
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        sceneCount={userUsage?.sceneCount ?? 0}
        limit={FREE_SCENE_LIMIT}
      />

      {/* Debug Panel - Development Only */}
      {isDev && !debugPanelHidden && (
        <div className="fixed bottom-4 right-4 z-50 bg-black/90 text-white p-4 rounded-xl shadow-2xl text-xs max-w-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-[10px] uppercase tracking-wider opacity-60">
              Debug States
            </div>
            <button
              onClick={() => setDebugPanelHidden(true)}
              className="p-1 rounded hover:bg-white/20 opacity-60 hover:opacity-100 transition-opacity"
              title="Hide until reload"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setDebugState("upload")}
              className={`px-2 py-1 rounded ${appState === "upload" ? "bg-white text-black" : "bg-white/20 hover:bg-white/30"}`}
            >
              Upload
            </button>
            <button
              onClick={() => setDebugState("processing", "uploading", 10)}
              className={`px-2 py-1 rounded ${appState === "processing" && processingStage === "uploading" ? "bg-white text-black" : "bg-white/20 hover:bg-white/30"}`}
            >
              Uploading
            </button>
            <button
              onClick={() => setDebugState("processing", "processing", 40)}
              className={`px-2 py-1 rounded ${appState === "processing" && processingStage === "processing" ? "bg-white text-black" : "bg-white/20 hover:bg-white/30"}`}
            >
              Processing
            </button>
            <button
              onClick={() => setDebugState("processing", "generating", 80)}
              className={`px-2 py-1 rounded ${appState === "processing" && processingStage === "generating" ? "bg-white text-black" : "bg-white/20 hover:bg-white/30"}`}
            >
              Generating
            </button>
            <button
              onClick={() => setDebugState("processing", "complete", 100)}
              className={`px-2 py-1 rounded ${appState === "processing" && processingStage === "complete" ? "bg-white text-black" : "bg-white/20 hover:bg-white/30"}`}
            >
              Complete
            </button>
            <button
              onClick={() => setDebugState("viewing")}
              className={`px-2 py-1 rounded ${appState === "viewing" ? "bg-white text-black" : "bg-white/20 hover:bg-white/30"}`}
            >
              Viewing
            </button>
            <button
              onClick={() => setDebugState("error")}
              className={`px-2 py-1 rounded ${appState === "error" && !isConfigError ? "bg-red-500" : "bg-red-500/50 hover:bg-red-500/70"}`}
            >
              Error
            </button>
            <button
              onClick={setDebugConfigError}
              className={`px-2 py-1 rounded ${appState === "error" && isConfigError ? "bg-orange-500" : "bg-orange-500/50 hover:bg-orange-500/70"}`}
            >
              Config Error
            </button>
          </div>
          <div className="mt-2 pt-2 border-t border-white/20 flex flex-wrap gap-1.5">
            <button
              onClick={addMockScenes}
              className="px-2 py-1 rounded bg-blue-500/50 hover:bg-blue-500/70"
            >
              + Mock Scenes
            </button>
            <button
              onClick={clearAllScenes}
              className="px-2 py-1 rounded bg-red-500/50 hover:bg-red-500/70"
            >
              Clear History
            </button>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="px-2 py-1 rounded bg-purple-500/50 hover:bg-purple-500/70"
            >
              Upgrade Modal
            </button>
          </div>
          {/* 3D Viewer Debug Controls */}
          {appState === "viewing" && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <div className="text-[10px] uppercase tracking-wider opacity-60 mb-2">
                3D Viewer
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    setViewerDebugLoading(undefined);
                    setViewerDebugError(undefined);
                  }}
                  className={`px-2 py-1 rounded ${viewerDebugLoading === undefined && viewerDebugError === undefined ? "bg-white text-black" : "bg-white/20 hover:bg-white/30"}`}
                >
                  Normal
                </button>
                <button
                  onClick={() => {
                    setViewerDebugLoading(25);
                    setViewerDebugError(undefined);
                  }}
                  className={`px-2 py-1 rounded ${viewerDebugLoading === 25 ? "bg-white text-black" : "bg-white/20 hover:bg-white/30"}`}
                >
                  Loading 25%
                </button>
                <button
                  onClick={() => {
                    setViewerDebugLoading(75);
                    setViewerDebugError(undefined);
                  }}
                  className={`px-2 py-1 rounded ${viewerDebugLoading === 75 ? "bg-white text-black" : "bg-white/20 hover:bg-white/30"}`}
                >
                  Loading 75%
                </button>
                <button
                  onClick={() => {
                    setViewerDebugLoading(undefined);
                    setViewerDebugError("Failed to load 3D model. Try again.");
                  }}
                  className={`px-2 py-1 rounded ${viewerDebugError !== undefined ? "bg-red-500" : "bg-red-500/50 hover:bg-red-500/70"}`}
                >
                  Load Error
                </button>
              </div>
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-white/20 text-[10px] opacity-50">
            Current: {appState} {appState === "processing" && `→ ${processingStage}`} | Scenes: {scenes.length} | Usage: {userUsage?.sceneCount ?? 0}/{FREE_SCENE_LIMIT}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 pt-12 pb-8 px-6">
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
                    className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight mb-1 flex items-center gap-2"
                  >
                    <span>2D</span>
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
                    <span>3D</span>
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
                  <ImageUpload 
                    onImageSelect={handleImageSelect} 
                    disabled={!canUpload}
                    onDisabledClick={() => setShowUpgradeModal(true)}
                  />
                </motion.div>

                {/* How it works OR Recent Scenes */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {historyLoaded && scenes.length > 0 ? (
                    // Recent Scenes List
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-[var(--text-secondary)]">
                          Recent Scenes
                        </h3>
                        {scenes.length > 1 && (
                          <button
                            onClick={clearAllScenes}
                            className="text-xs text-[var(--text-muted)] hover:text-[var(--error)] transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                            Clear all
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {scenes.map((scene, index) => (
                          <motion.div
                            key={scene.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleSelectScene(scene)}
                            onMouseEnter={() => setHoveredSceneId(scene.id)}
                            onMouseLeave={() => setHoveredSceneId(null)}
                            className="group flex items-center gap-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-hover)] hover:bg-[var(--warm-tint)] transition-all cursor-pointer"
                          >
                            {/* Thumbnail with 3D preview on hover */}
                            <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-[var(--surface-elevated)] flex-shrink-0">
                              {/* Static image preview */}
                              <Image
                                src={scene.previewUrl}
                                alt={scene.name}
                                fill
                                className={`object-cover transition-opacity duration-200 ${
                                  hoveredSceneId === scene.id ? "opacity-0" : "opacity-100"
                                }`}
                                unoptimized
                              />
                              {/* Interactive 3D preview on hover */}
                              {hoveredSceneId === scene.id && (
                                <div className="absolute inset-0">
                                  <GaussianViewer
                                    modelUrl={scene.modelUrl}
                                    modelType={scene.modelType}
                                    mini
                                  />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {scene.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                <span className="uppercase">{scene.modelType}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" strokeWidth={1.5} />
                                  {formatRelativeTime(scene.createdAt)}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeScene(scene.id);
                                }}
                                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </button>
                              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" strokeWidth={1.5} />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // Features - minimal centered style
                    <div className="flex items-start justify-center gap-8 py-4">
                      {/* 3 Free scenes */}
                      <div className="step-card">
                        <div className="step-card-icon">3</div>
                        <div className="step-card-title">Free scenes</div>
                      </div>

                      {/* With upgrade */}
                      <div className="step-card">
                        <div className="step-card-icon">∞</div>
                        <div className="step-card-title">With upgrade</div>
                      </div>

                      {/* AI-powered */}
                      <div className="step-card">
                        <div className="step-card-icon">
                          <Sparkles className="w-8 h-8" strokeWidth={1.5} />
                        </div>
                        <div className="step-card-title">AI-powered</div>
                      </div>
                    </div>
                  )}
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

                {/* Preview with pixelated loading effect */}
                {previewUrl && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full max-w-sm mx-auto aspect-[4/3] rounded-2xl overflow-hidden border border-[var(--border)] mb-8 bg-[var(--surface)]"
                  >
                    <PixelatedImage
                      src={previewUrl}
                      alt="Processing"
                      className="absolute inset-0 w-full h-full"
                    />
                  </motion.div>
                )}

                <ProcessingStatus
                  status={processingStage}
                  progress={progress}
                  errorMessage={error || undefined}
                  stageProgress={processingStage === "processing" ? stageProgress : undefined}
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
                <div className="mb-6">
                  <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <button
                      onClick={handleReset}
                      className="icon-btn flex-shrink-0"
                      aria-label="Back to home"
                    >
                      <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                    </button>
                    <h2 className="text-2xl font-semibold truncate">
                      {currentSceneName || "Your 3D Scene"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={handleShareScene}
                      className="icon-btn-label"
                      aria-label={copied ? "Copied" : "Share"}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" strokeWidth={2} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4" strokeWidth={2} />
                          <span>Share</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                </div>

                {/* 3D Viewer */}
                <GaussianViewer
                  modelUrl={modelUrl}
                  modelType={modelType}
                  debugLoading={viewerDebugLoading}
                  debugError={viewerDebugError}
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
                      {setupInstructions.step4 && (
                        <div className="flex gap-3">
                          <span className="text-[var(--text-muted)]">4.</span>
                          <span>{setupInstructions.step4}</span>
                        </div>
                      )}
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
            <button
              onClick={() => signOut()}
              className="text-link cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
