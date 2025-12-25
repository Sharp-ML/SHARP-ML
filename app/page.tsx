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
  Sparkles,
  HelpCircle,
  LogOut,
  MessageCircle,
  Upload,
  Wand2,
} from "lucide-react";
import { ImageIcon } from "@/components/ui/image";
import Image from "next/image";
import ImageUpload from "./components/ImageUpload";
import PromptInput from "./components/PromptInput";
import FollowupInput from "./components/FollowupInput";
import GaussianViewer from "./components/GaussianViewer";
import ProcessingStatus from "./components/ProcessingStatus";
import PixelatedImage from "./components/PixelatedImage";
import { useScenesHistory, SavedScene } from "./hooks/useScenesHistory";
import { AuthGate } from "./components/AuthGate";
import { signOut } from "next-auth/react";
import { UpgradeModal } from "./components/UpgradeModal";

// Free tier limit (override with Infinity in local dev for easier testing)
const FREE_SCENE_LIMIT = process.env.NODE_ENV === "development" ? Infinity : 10;

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

function formatRelativeTime(dateInput: string | number): string {
  const timestamp = typeof dateInput === "string" ? new Date(dateInput).getTime() : dateInput;
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
  const [activeTab, setActiveTab] = useState<"upload" | "prompt">("prompt");
  const [processingStage, setProcessingStage] =
    useState<ProcessingStage>("uploading");
  const [processingMode, setProcessingMode] = useState<"upload" | "prompt">("upload");
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
  
  // Regeneration state for follow-up prompts
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null);

  // In-progress scene state (for background generation when navigating away)
  interface InProgressScene {
    id: string;
    name: string;
    previewUrl: string | null;
    startedAt: number;
    isFollowup?: boolean; // True if this is a followup regeneration
  }
  const [inProgressScene, setInProgressScene] = useState<InProgressScene | null>(null);
  const inProgressAbortRef = useRef<AbortController | null>(null);
  
  // Track if user is still watching the processing screen (to prevent auto-open when viewing another scene)
  const isWatchingProcessingRef = useRef<boolean>(false);
  
  // Track the scene ID being viewed to prevent state mixing
  const viewingSceneIdRef = useRef<string | null>(null);

  // Usage tracking state
  const [userUsage, setUserUsage] = useState<UserUsage | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const helpMenuRef = useRef<HTMLDivElement>(null);

  // Close help menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (helpMenuRef.current && !helpMenuRef.current.contains(event.target as Node)) {
        setShowHelpMenu(false);
      }
    }
    if (showHelpMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHelpMenu]);

  // Scene history persistence (from authenticated API)
  const {
    scenes,
    isLoaded: historyLoaded,
    refreshScenes,
    removeScene,
    clearAllScenes,
  } = useScenesHistory();

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

  // Note: URL-based scene sharing has been removed for security.
  // Users can only access their own scenes stored in localStorage.

  // Check if user can upload
  const canUpload = userUsage?.isPaid || (userUsage?.remainingUploads ?? FREE_SCENE_LIMIT) > 0;

  const handleImageSelect = useCallback(async (file: File) => {
    // Check if user can upload before proceeding
    if (!canUpload) {
      setShowUpgradeModal(true);
      return;
    }

    // Create abort controller for this request
    const abortController = new AbortController();
    inProgressAbortRef.current = abortController;

    // Mark that user is watching this processing
    isWatchingProcessingRef.current = true;
    viewingSceneIdRef.current = null; // Clear any scene being viewed

    setAppState("processing");
    setProcessingMode("upload");
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

    // Create in-progress scene ID
    const inProgressId = `in-progress-${Date.now()}`;

    // Set in-progress scene with preview
    setInProgressScene({
      id: inProgressId,
      name: fileName,
      previewUrl: preview,
      startedAt: Date.now(),
    });

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
        signal: abortController.signal,
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

      // Update usage from response
      if (data.usage) {
        setUserUsage({
          sceneCount: data.usage.sceneCount,
          isPaid: data.usage.isPaid,
          remainingUploads: data.usage.remainingUploads,
        });
      }

      // Clear in-progress scene
      setInProgressScene(null);
      inProgressAbortRef.current = null;

      // Refresh scenes list from server (scene was already created by the API)
      await refreshScenes();

      // Only transition to viewing if user is still watching this processing
      // (not if they navigated back home or are viewing another scene)
      if (isWatchingProcessingRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        setAppState("viewing");
      }
    } catch (err) {
      // Ensure progress timer is cleaned up on error
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      // Don't treat abort as an error
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      console.error("Processing error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setProcessingStage("error");
      // Only show error state if user is still watching
      if (isWatchingProcessingRef.current) {
        setAppState("error");
      }
      // Clear in-progress scene on error
      setInProgressScene(null);
      inProgressAbortRef.current = null;
    }
  }, [refreshScenes, canUpload]);

  // Handle prompt submission - generates image then converts to 3D
  // Supports background processing when user navigates away
  const handlePromptSubmit = useCallback(async (prompt: string) => {
    // Check if user can upload before proceeding
    if (!canUpload) {
      setShowUpgradeModal(true);
      return;
    }

    // Create abort controller for this request
    const abortController = new AbortController();
    inProgressAbortRef.current = abortController;

    // Mark that user is watching this processing
    isWatchingProcessingRef.current = true;
    viewingSceneIdRef.current = null; // Clear any scene being viewed

    setAppState("processing");
    setProcessingMode("prompt");
    setProcessingStage("uploading");
    setProgress(0);
    setStageProgress(undefined);
    setError(null);
    setIsConfigError(false);
    setSetupInstructions(null);

    // Store the prompt as scene name (truncate if too long)
    const sceneName = prompt.length > 50 ? prompt.substring(0, 47) + "..." : prompt;
    setCurrentSceneName(sceneName);

    // Create in-progress scene ID
    const inProgressId = `in-progress-${Date.now()}`;

    // Set in-progress scene immediately (before API call) so it shows in home if user navigates away
    setInProgressScene({
      id: inProgressId,
      name: sceneName,
      previewUrl: null, // Will be updated once image is generated
      startedAt: Date.now(),
    });

    try {
      // Step 1: Generate image from prompt
      setProgress(5);
      
      const generateResponse = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: abortController.signal,
      });

      if (!generateResponse.ok) {
        const data = await generateResponse.json();
        if (data.setup) {
          setIsConfigError(true);
          setSetupInstructions(data.setup);
        }
        throw new Error(data.error || "Failed to generate image");
      }

      const generateData = await generateResponse.json();
      setProgress(10);

      // Set preview from generated image
      setPreviewUrl(generateData.imageUrl);

      // Update in-progress scene with the preview
      setInProgressScene({
        id: inProgressId,
        name: sceneName,
        previewUrl: generateData.imageUrl,
        startedAt: Date.now(),
      });

      // Step 2: Convert generated image to File and process to 3D
      const imageResponse = await fetch(generateData.imageUrl);
      const imageBlob = await imageResponse.blob();
      const imageFile = new File([imageBlob], `${sceneName}.png`, { type: "image/png" });

      // Continue with existing 3D processing flow
      setProcessingStage("processing");
      setStageProgress(0);

      const formData = new FormData();
      formData.append("image", imageFile);

      setProgress(20);

      // Start progress estimation timer
      const estimatedDuration = 60000;
      const startTime = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const rawProgress = Math.min(95, (elapsed / estimatedDuration) * 100);
        const easedProgress = rawProgress < 50 
          ? rawProgress 
          : 50 + (rawProgress - 50) * 0.5;
        setStageProgress(Math.min(95, easedProgress));
      }, 500);

      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      clearInterval(progressInterval);
      setStageProgress(100);
      setProgress(30);

      if (response.status === 413) {
        throw new Error("Generated image too large. Please try a different prompt.");
      }
      if (response.status === 401) {
        throw new Error("Please sign in to continue.");
      }
      if (response.status === 402) {
        setShowUpgradeModal(true);
        throw new Error("You've reached your free limit. Upgrade to continue.");
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Server error. Please try again.");
      }

      if (!response.ok) {
        if (data.setup) {
          setIsConfigError(true);
          setSetupInstructions(data.setup);
          throw new Error(data.message || "Server configuration error");
        }
        if (data.requiresPayment) {
          setShowUpgradeModal(true);
        }
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}` 
          : data.error || "Processing failed";
        throw new Error(errorMsg);
      }

      setStageProgress(undefined);

      for (let i = 30; i <= 90; i += 10) {
        await new Promise((r) => setTimeout(r, 200));
        setProgress(i);
      }

      setProcessingStage("generating");
      setProgress(95);
      setProcessingStage("complete");
      setProgress(100);

      setModelUrl(data.modelUrl);
      setModelType(data.modelType || "glb");
      setImageUrl(data.imageUrl || null);

      if (data.usage) {
        setUserUsage({
          sceneCount: data.usage.sceneCount,
          isPaid: data.usage.isPaid,
          remainingUploads: data.usage.remainingUploads,
        });
      }

      // Store the original prompt for follow-up regeneration
      setOriginalPrompt(prompt);

      // Clear in-progress scene
      setInProgressScene(null);
      inProgressAbortRef.current = null;

      await refreshScenes();
      
      // Only transition to viewing if user is still watching this processing
      if (isWatchingProcessingRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        setAppState("viewing");
      }
    } catch (err) {
      // Don't treat abort as an error
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      console.error("Prompt processing error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setProcessingStage("error");
      // Only show error state if user is still watching
      if (isWatchingProcessingRef.current) {
        setAppState("error");
      }
      // Clear in-progress scene on error
      setInProgressScene(null);
      inProgressAbortRef.current = null;
    }
  }, [refreshScenes, canUpload]);

  // Handle follow-up prompt submission - edits existing image and regenerates 3D scene
  const handleFollowupSubmit = useCallback(async (followup: string) => {
    // Check if user can upload before proceeding
    if (!canUpload) {
      setShowUpgradeModal(true);
      return;
    }

    // Need an existing image to edit
    if (!imageUrl && !previewUrl) {
      setError("No existing image to edit. Please create a scene first.");
      return;
    }

    const sourceImageUrl = imageUrl || previewUrl;
    const sceneName = followup.length > 50 ? followup.substring(0, 47) + "..." : followup;
    const inProgressId = `followup-${Date.now()}`;

    // Mark that user is watching this regeneration (can navigate away)
    isWatchingProcessingRef.current = true;

    setIsRegenerating(true);
    setError(null);

    // Set in-progress scene for followup so it shows in home if user navigates away
    setInProgressScene({
      id: inProgressId,
      name: sceneName,
      previewUrl: sourceImageUrl,
      startedAt: Date.now(),
      isFollowup: true,
    });

    try {
      // Step 1: Edit the existing image using the follow-up prompt
      const editResponse = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          imageUrl: sourceImageUrl,
          editPrompt: followup 
        }),
      });

      if (!editResponse.ok) {
        const data = await editResponse.json();
        throw new Error(data.error || data.message || "Failed to edit image");
      }

      const editData = await editResponse.json();

      // Update preview with edited image
      setPreviewUrl(editData.imageUrl);

      // Update in-progress scene with the new preview
      setInProgressScene({
        id: inProgressId,
        name: sceneName,
        previewUrl: editData.imageUrl,
        startedAt: Date.now(),
        isFollowup: true,
      });

      // Step 2: Convert edited image to File and process to 3D
      const imageResponse = await fetch(editData.imageUrl);
      const imageBlob = await imageResponse.blob();
      const imageFile = new File([imageBlob], `${sceneName}.png`, { type: "image/png" });

      const formData = new FormData();
      formData.append("image", imageFile);

      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      if (response.status === 413) {
        throw new Error("Edited image too large. Please try a different prompt.");
      }
      if (response.status === 401) {
        throw new Error("Please sign in to continue.");
      }
      if (response.status === 402) {
        setShowUpgradeModal(true);
        throw new Error("You've reached your free limit. Upgrade to continue.");
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Server error. Please try again.");
      }

      if (!response.ok) {
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}` 
          : data.error || "Processing failed";
        throw new Error(errorMsg);
      }

      // Clear in-progress scene
      setInProgressScene(null);

      // Update the original prompt to track the edit history
      const updatedPrompt = originalPrompt 
        ? `${originalPrompt}. Then: ${followup}`
        : followup;

      if (data.usage) {
        setUserUsage({
          sceneCount: data.usage.sceneCount,
          isPaid: data.usage.isPaid,
          remainingUploads: data.usage.remainingUploads,
        });
      }

      await refreshScenes();

      // Only update the viewing state if user is still watching
      if (isWatchingProcessingRef.current) {
        setModelUrl(data.modelUrl);
        setModelType(data.modelType || "glb");
        setImageUrl(data.imageUrl || null);
        setCurrentSceneName(sceneName);
        setOriginalPrompt(updatedPrompt);
      }
    } catch (err) {
      console.error("Followup processing error:", err);
      // Only show error if user is still watching
      if (isWatchingProcessingRef.current) {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
      // Clear in-progress scene on error
      setInProgressScene(null);
    } finally {
      setIsRegenerating(false);
    }
  }, [refreshScenes, canUpload, originalPrompt, imageUrl, previewUrl]);

  // Navigate back to home during processing (keeps generation running in background)
  const handleBackDuringProcessing = useCallback(() => {
    // Mark that user is no longer watching this processing
    isWatchingProcessingRef.current = false;
    
    // Reset UI state but keep the in-progress scene
    setAppState("upload");
    setProcessingStage("uploading");
    setProgress(0);
    setStageProgress(undefined);
    setPreviewUrl(null);
    setError(null);
    setIsConfigError(false);
    setSetupInstructions(null);
    setCurrentSceneName(null);
    // Note: We intentionally do NOT clear inProgressScene here
    // The generation continues in the background
  }, []);

  // Navigate back to home during followup regeneration (keeps generation running in background)
  const handleBackDuringRegeneration = useCallback(() => {
    // Mark that user is no longer watching this regeneration
    isWatchingProcessingRef.current = false;
    
    // Reset UI state but keep the in-progress scene (for regeneration)
    setAppState("upload");
    setPreviewUrl(null);
    setError(null);
    setCurrentSceneName(null);
    setModelUrl(null);
    setModelType("glb");
    setImageUrl(null);
    setOriginalPrompt(null);
    // Note: We intentionally do NOT clear inProgressScene or isRegenerating here
    // The regeneration continues in the background
  }, []);

  const handleReset = useCallback(() => {
    // Clear watching state
    isWatchingProcessingRef.current = false;
    viewingSceneIdRef.current = null;
    
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
    // Clear regeneration state for current view (but NOT in-progress scene - let background task handle it)
    setIsRegenerating(false);
    setOriginalPrompt(null);
    // Note: We intentionally do NOT clear inProgressScene here
    // Background tasks manage their own cleanup when they complete
    // Clear URL parameters
    router.replace("/", { scroll: false });
  }, [router]);

  // Handler for selecting a scene from history
  const handleSelectScene = useCallback((scene: SavedScene) => {
    // Mark that user is now viewing a specific scene (not watching a processing)
    isWatchingProcessingRef.current = false;
    viewingSceneIdRef.current = scene.id;
    
    setModelUrl(scene.modelUrl);
    setModelType(scene.modelType);
    setPreviewUrl(scene.imageUrl); // Use imageUrl as preview (from Vercel Blob)
    setImageUrl(scene.imageUrl);
    setCurrentSceneName(scene.name);
    setAppState("viewing");
    setError(null);
    setIsConfigError(false);
    // Clear regeneration state - we don't have the original prompt for history scenes
    setIsRegenerating(false);
    setOriginalPrompt(null);
  }, []);

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

  // Refresh scenes from server (for debugging)
  const handleRefreshScenes = async () => {
    await refreshScenes();
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
              onClick={handleRefreshScenes}
              className="px-2 py-1 rounded bg-blue-500/50 hover:bg-blue-500/70"
            >
              Refresh Scenes
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
            <button
              onClick={() => setUserUsage({ sceneCount: 10, isPaid: false, remainingUploads: 0 })}
              className={`px-2 py-1 rounded ${userUsage?.remainingUploads === 0 ? "bg-yellow-500" : "bg-yellow-500/50 hover:bg-yellow-500/70"}`}
            >
              Max Limit
            </button>
            <button
              onClick={() => setUserUsage({ sceneCount: 0, isPaid: false, remainingUploads: 10 })}
              className="px-2 py-1 rounded bg-green-500/50 hover:bg-green-500/70"
            >
              Reset Limit
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
          <div className="mt-2 pt-2 border-t border-white/20 text-[10px] opacity-50 tabular-nums">
            Current: {appState} {appState === "processing" && `→ ${processingStage}`} | Scenes: {scenes.length} | Usage: {userUsage?.sceneCount ?? 0}/{FREE_SCENE_LIMIT === Infinity ? "∞" : FREE_SCENE_LIMIT}
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

                {/* Tab Selector */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mb-6"
                >
                  <div className="inline-flex p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <button
                      onClick={() => setActiveTab("prompt")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === "prompt"
                          ? "bg-[var(--foreground)] text-[var(--background)] shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <Wand2 className="w-4 h-4" strokeWidth={2} />
                      <span>Prompt</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("upload")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === "upload"
                          ? "bg-[var(--foreground)] text-[var(--background)] shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <Upload className="w-4 h-4" strokeWidth={2} />
                      <span>Upload</span>
                    </button>
                  </div>
                </motion.div>

                {/* Upload Zone / Prompt Input */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-10"
                >
                  <AnimatePresence mode="wait">
                    {activeTab === "upload" ? (
                      <motion.div
                        key="upload-tab"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ImageUpload 
                          onImageSelect={handleImageSelect} 
                          disabled={!canUpload}
                          onDisabledClick={() => setShowUpgradeModal(true)}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="prompt-tab"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <PromptInput
                          onSubmit={handlePromptSubmit}
                          disabled={!canUpload}
                          onDisabledClick={() => setShowUpgradeModal(true)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* How it works OR Recent Scenes */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {(historyLoaded && scenes.length > 0) || inProgressScene ? (
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
                        {/* In-progress scene (shown first with loading state) */}
                        {inProgressScene && (
                          <motion.div
                            key={inProgressScene.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group flex items-center gap-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-all"
                          >
                            {/* Thumbnail with loading state */}
                            <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-[var(--surface-elevated)] flex-shrink-0">
                              {inProgressScene.previewUrl ? (
                                <Image
                                  src={inProgressScene.previewUrl}
                                  alt={inProgressScene.name}
                                  fill
                                  className="object-cover opacity-60"
                                  unoptimized
                                />
                              ) : (
                                <div className="absolute inset-0 shimmer" />
                              )}
                              {/* Loading spinner overlay */}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-5 h-5 rounded-full border-2 border-white/80 border-t-transparent spin-slow" />
                              </div>
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {inProgressScene.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                <span className="flex items-center gap-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
                                  {inProgressScene.isFollowup ? "Regenerating..." : "Generating..."}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                        {/* Completed scenes */}
                        {scenes.map((scene, index) => (
                          <motion.div
                            key={scene.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: (inProgressScene ? index + 1 : index) * 0.05 }}
                            onClick={() => handleSelectScene(scene)}
                            className="group flex items-center gap-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-hover)] hover:bg-[var(--warm-tint)] transition-all cursor-pointer"
                          >
                            {/* Thumbnail */}
                            <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-[var(--surface-elevated)] flex-shrink-0">
                              <Image
                                src={scene.imageUrl}
                                alt={scene.name}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {scene.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                <span className="uppercase">{scene.modelType}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1 tabular-nums">
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
                  ) : null}
                </motion.div>
              </motion.div>
            )}

            {appState === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-xl mx-auto pt-8"
              >
                {/* Back button */}
                <div className="mb-6">
                  <button
                    onClick={handleBackDuringProcessing}
                    className="icon-btn"
                    aria-label="Back to home"
                    title="Go back (processing continues in background)"
                  >
                    <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>

                <div className="text-center mb-8">
                  <h2 className="text-2xl font-semibold mb-2">
                    Creating Your 3D Scene
                  </h2>
                  <p className="text-[var(--text-muted)]">
                    Analyzing your image and generating a 3D representation...
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    You can go back while this processes
                  </p>
                </div>

                {/* Preview with pixelated loading effect - always reserve space to prevent layout shift */}
                <div className="relative w-full max-w-sm mx-auto aspect-[4/3] rounded-2xl overflow-hidden border border-[var(--border)] mb-8 bg-[var(--surface)]">
                  {previewUrl ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0"
                    >
                      <PixelatedImage
                        src={previewUrl}
                        alt="Processing"
                        className="absolute inset-0 w-full h-full"
                      />
                    </motion.div>
                  ) : (
                    /* Placeholder shimmer while generating/uploading */
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="absolute inset-0 shimmer" />
                      <ImageIcon size={32} className="text-[var(--text-muted)] opacity-30" />
                    </div>
                  )}
                </div>

                <ProcessingStatus
                  status={processingStage}
                  progress={progress}
                  errorMessage={error || undefined}
                  stageProgress={processingStage === "processing" ? stageProgress : undefined}
                  mode={processingMode}
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
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <button
                      onClick={isRegenerating ? handleBackDuringRegeneration : handleReset}
                      className="icon-btn flex-shrink-0"
                      aria-label="Back to home"
                      title={isRegenerating ? "Go back (regeneration continues in background)" : "Back to home"}
                    >
                      <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                    </button>
                    <h2 className="text-2xl font-semibold truncate">
                      {currentSceneName || "Your 3D Scene"}
                    </h2>
                    {isRegenerating && (
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-[var(--warning)] animate-pulse" />
                        <span>Regenerating...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3D Viewer */}
                <GaussianViewer
                  modelUrl={modelUrl}
                  modelType={modelType}
                  debugLoading={viewerDebugLoading}
                  debugError={viewerDebugError}
                  isRegenerating={isRegenerating}
                />

                {/* Follow-up Input for regeneration */}
                <FollowupInput
                  onSubmit={handleFollowupSubmit}
                  isLoading={isRegenerating}
                  disabled={!canUpload}
                />

                {/* Error message during regeneration */}
                {error && isRegenerating === false && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 rounded-xl bg-[var(--error)]/10 border border-[var(--error)]/20 text-sm text-[var(--error)]"
                  >
                    {error}
                  </motion.div>
                )}
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
              ML-SHARP
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
              href="https://github.com/Sharp-ML/SHARP-ML"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link flex items-center gap-2"
            >
              <Github className="w-4 h-4" strokeWidth={1.5} />
              <span>GitHub</span>
            </a>
            <div className="relative" ref={helpMenuRef}>
              <button
                onClick={() => setShowHelpMenu(!showHelpMenu)}
                className="text-link cursor-pointer p-1 hover:bg-[var(--foreground)]/10 rounded-full transition-colors"
                aria-label="Help menu"
              >
                <HelpCircle className="w-5 h-5" strokeWidth={1.5} />
              </button>
              <AnimatePresence>
                {showHelpMenu && (
<motion.div
                   initial={{ opacity: 0, y: 8, scale: 0.95 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   transition={{ duration: 0.1 }}
                   style={{ transformOrigin: "bottom right" }}
                   className="absolute bottom-full right-0 mb-2 w-40 bg-[var(--background)] border border-[var(--foreground)]/10 rounded-lg shadow-lg p-1.5 flex flex-col"
                 >
                    <a
                      href="https://x.com/messages/compose?recipient_id=1325862778603769856"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-[var(--foreground)]/5 rounded-md"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Contact Support</span>
                    </a>
                    <button
                      onClick={() => {
                        setShowHelpMenu(false);
                        signOut();
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-[var(--foreground)]/5 rounded-md w-full text-left cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Log out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
