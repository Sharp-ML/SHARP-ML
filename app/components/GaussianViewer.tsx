"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2,
  Download,
  Move3D,
  MousePointer2,
  Video,
  Box,
  X,
  RotateCcw,
} from "lucide-react";
import { Application, Entity } from "@playcanvas/react";
import { Camera, GSplat, Script } from "@playcanvas/react/components";
import { useApp } from "@playcanvas/react/hooks";
import { Asset, Color } from "playcanvas";
import * as THREE from "three";
import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";

type ViewMode = "scene" | "video";

interface GaussianViewerProps {
  modelUrl: string;
  modelType?: "sog" | "ply" | "glb" | "gltf";
  /** Debug: Force loading state with optional progress (0-100) */
  debugLoading?: boolean | number;
  /** Debug: Force error state with optional message */
  debugError?: boolean | string;
  /** Mini mode: auto-rotate, no controls, no overlays - for small previews */
  mini?: boolean;
  /** Show regenerating visual effect */
  isRegenerating?: boolean;
}

// ============================================================================
// SOG VIEWER (PlayCanvas) - For new .sog format
// ============================================================================

// Inner component that uses PlayCanvas hooks and loads the SOG splat asset
function SogSplatScene({
  modelUrl,
  onLoadStart,
  onLoadComplete,
  onLoadError,
  onLoadProgress,
}: {
  modelUrl: string;
  onLoadStart: () => void;
  onLoadComplete: () => void;
  onLoadError: (error: Error) => void;
  onLoadProgress: (progress: number) => void;
}) {
  const app = useApp();
  const [asset, setAsset] = useState<Asset | null>(null);
  const loadedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!app || !modelUrl || loadedUrlRef.current === modelUrl) return;
    loadedUrlRef.current = modelUrl;

    onLoadStart();

    // PlayCanvas gsplat asset type handles .sog format
    let assetUrl = modelUrl;
    const urlPath = modelUrl.split("?")[0].toLowerCase();
    const hasKnownExtension =
      urlPath.endsWith(".sog") ||
      urlPath.endsWith(".splat") ||
      urlPath.endsWith(".ksplat");

    if (!hasKnownExtension) {
      // Add filename hint as query parameter for PlayCanvas to detect format
      const separator = modelUrl.includes("?") ? "&" : "?";
      assetUrl = `${modelUrl}${separator}filename=scene.sog`;
    }

    const splatAsset = new Asset(`splat-${Date.now()}`, "gsplat", {
      url: assetUrl,
      filename: "scene.sog",
    });

    // Track loading progress
    splatAsset.on("progress", (received: number, total: number) => {
      if (total > 0) {
        onLoadProgress(Math.round((received / total) * 100));
      }
    });

    splatAsset.on("load", () => {
      setAsset(splatAsset);
      onLoadComplete();
    });

    splatAsset.on("error", (err: Error | string) => {
      const errorMsg =
        typeof err === "string" ? err : err?.message || "Unknown error";
      const enhancedError = new Error(
        errorMsg.includes("Failed to fetch")
          ? "Failed to load 3D scene. The model file may not exist or is still processing."
          : `Failed to load 3D scene: ${errorMsg}`,
      );
      onLoadError(enhancedError);
    });

    // Add and load the asset
    app.assets.add(splatAsset);
    app.assets.load(splatAsset);

    return () => {
      if (splatAsset) {
        splatAsset.off("progress");
        splatAsset.off("load");
        splatAsset.off("error");
        app.assets.remove(splatAsset);
        splatAsset.unload();
      }
    };
  }, [app, modelUrl, onLoadStart, onLoadComplete, onLoadError, onLoadProgress]);

  if (!asset) return null;

  return (
    <Entity position={[0, 0, 0]} rotation={[0, 0, 0]}>
      <GSplat asset={asset} />
    </Entity>
  );
}

// Camera controls script for PlayCanvas orbit behavior
function CameraOrbitScript() {
  const [CameraControls, setCameraControls] = useState<unknown>(null);

  useEffect(() => {
    import("playcanvas/scripts/esm/camera-controls.mjs").then((module) => {
      setCameraControls(() => module.CameraControls);
    });
  }, []);

  if (!CameraControls) return null;

  return <Script script={CameraControls as never} />;
}

// ============================================================================
// PLY VIEWER (Three.js + @mkkellogg/gaussian-splats-3d) - For legacy .ply format
// ============================================================================

interface PlyViewerProps {
  modelUrl: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onLoadStart: () => void;
  onLoadComplete: () => void;
  onLoadError: (error: Error) => void;
  onLoadProgress: (progress: number) => void;
  mini: boolean;
  resetKey: number;
}

function usePlyViewer({
  modelUrl,
  containerRef,
  onLoadStart,
  onLoadComplete,
  onLoadError,
  onLoadProgress,
  mini,
  resetKey,
}: PlyViewerProps) {
  const viewerRef = useRef<GaussianSplats3D.Viewer | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const loadedUrlRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const autoRotateRef = useRef<number | null>(null);

  // Store callbacks in refs to avoid dependency changes triggering re-runs
  const callbacksRef = useRef({
    onLoadStart,
    onLoadComplete,
    onLoadError,
    onLoadProgress,
  });
  callbacksRef.current = {
    onLoadStart,
    onLoadComplete,
    onLoadError,
    onLoadProgress,
  };

  useEffect(() => {
    isMountedRef.current = true;
    const container = containerRef.current;

    // Skip if no URL provided (non-PLY format)
    if (!modelUrl) return;
    if (!container) return;

    // Skip if already loaded this URL (unless reset triggered)
    const loadKey = `${modelUrl}-${resetKey}`;
    if (loadedUrlRef.current === loadKey) return;
    loadedUrlRef.current = loadKey;

    // Clean up any existing auto-rotate
    if (autoRotateRef.current) {
      cancelAnimationFrame(autoRotateRef.current);
      autoRotateRef.current = null;
    }

    // Clean up any existing viewer
    if (viewerRef.current) {
      try {
        viewerRef.current.dispose();
      } catch {
        // Ignore disposal errors
      }
      viewerRef.current = null;
    }

    // Clean up any existing renderer
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    // Clear the container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Signal loading start
    callbacksRef.current.onLoadStart();

    // Ensure container has dimensions
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Create Three.js renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x1a1a1a, 1); // Dark background

    // Style the canvas to fill the container
    const canvas = renderer.domElement;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";

    container.appendChild(canvas);
    rendererRef.current = renderer;

    console.log("[PLY Viewer] Initializing viewer for:", modelUrl);
    console.log("[PLY Viewer] Container size:", width, "x", height);

    // Create the Gaussian Splat viewer
    const viewer = new GaussianSplats3D.Viewer({
      renderer,
      cameraUp: [0, 1, 0], // Standard Y-up
      initialCameraPosition: [0, 0, 5],
      initialCameraLookAt: [0, 0, 0],
      selfDrivenMode: true,
      useBuiltInControls: !mini,
      dynamicScene: false,
      sharedMemoryForWorkers: false,
    });

    viewerRef.current = viewer;

    console.log("[PLY Viewer] Starting to load splat scene...");

    // Load the PLY file
    viewer
      .addSplatScene(modelUrl, {
        showLoadingUI: false,
        progressiveLoad: true,
        onProgress: (progress: number, message: string, stage: string) => {
          console.log("[PLY Viewer] Progress:", progress, message, stage);
          if (isMountedRef.current) {
            // Progress is already 0-100, don't multiply
            callbacksRef.current.onLoadProgress(Math.round(progress));
          }
        },
      })
      .then(() => {
        console.log("[PLY Viewer] Load complete!");
        // Only proceed if still mounted
        if (!isMountedRef.current) return;

        // Center camera on the loaded scene
        if (viewerRef.current) {
          const splatMesh = viewerRef.current.splatMesh;
          const cam = viewerRef.current.camera;

          if (splatMesh && splatMesh.boundingBox) {
            const box = splatMesh.boundingBox;
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            box.getCenter(center);
            box.getSize(size);

            // Calculate appropriate camera distance based on scene size
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = cam.fov * (Math.PI / 180);
            const cameraDistance =
              Math.max(maxDim / (2 * Math.tan(fov / 2)), 1) * 1.5;

            console.log(
              "[PLY Viewer] Scene center:",
              center.x,
              center.y,
              center.z,
            );
            console.log("[PLY Viewer] Scene size:", size.x, size.y, size.z);
            console.log("[PLY Viewer] Camera distance:", cameraDistance);

            // Position camera to look at scene center from an angle
            cam.position.set(
              center.x,
              center.y + cameraDistance * 0.3,
              center.z + cameraDistance,
            );
            cam.lookAt(center);
            cam.updateProjectionMatrix();

            // Update controls target if available
            if (
              viewerRef.current.controls &&
              viewerRef.current.controls.target
            ) {
              viewerRef.current.controls.target.copy(center);
              viewerRef.current.controls.update?.();
            }
          } else {
            console.log(
              "[PLY Viewer] No bounding box available, using default camera position",
            );
          }

          console.log(
            "[PLY Viewer] Final camera position:",
            cam.position.x,
            cam.position.y,
            cam.position.z,
          );
          console.log(
            "[PLY Viewer] Canvas in DOM:",
            !!rendererRef.current?.domElement?.parentElement,
          );
        }

        callbacksRef.current.onLoadComplete();

        // Start auto-rotate in mini mode
        if (mini && viewerRef.current) {
          // Get the scene center for rotation (default to origin if no bounding box)
          const rotationCenter = new THREE.Vector3(0, 0, 0);
          const splatMeshMini = viewerRef.current.splatMesh;
          if (splatMeshMini && splatMeshMini.boundingBox) {
            splatMeshMini.boundingBox.getCenter(rotationCenter);
          }

          const autoRotate = () => {
            if (viewerRef.current && isMountedRef.current) {
              // Rotate camera around the scene center
              const cam = viewerRef.current.camera;
              const offset = cam.position.clone().sub(rotationCenter);
              offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.002);
              cam.position.copy(rotationCenter.clone().add(offset));
              cam.lookAt(rotationCenter);
              autoRotateRef.current = requestAnimationFrame(autoRotate);
            }
          };
          autoRotate();
        }
      })
      .catch((err: Error) => {
        console.error("[PLY Viewer] Load error:", err);
        // Only report error if still mounted and not a disposal error
        if (!isMountedRef.current) return;

        const errorMsg = err?.message || String(err);
        // Ignore "disposed" errors - they're expected during cleanup
        if (errorMsg.toLowerCase().includes("disposed")) {
          return;
        }

        callbacksRef.current.onLoadError(
          new Error(errorMsg || "Failed to load 3D scene"),
        );
      });

    // Handle resize
    const handleResize = () => {
      if (container && viewerRef.current && rendererRef.current) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        rendererRef.current.setSize(width, height);
        viewerRef.current.camera.aspect = width / height;
        viewerRef.current.camera.updateProjectionMatrix();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("resize", handleResize);

      // Cancel auto-rotate
      if (autoRotateRef.current) {
        cancelAnimationFrame(autoRotateRef.current);
        autoRotateRef.current = null;
      }

      // Dispose viewer
      if (viewerRef.current) {
        try {
          viewerRef.current.dispose();
        } catch {
          // Ignore disposal errors
        }
        viewerRef.current = null;
      }

      // Dispose renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [modelUrl, containerRef, mini, resetKey]);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GaussianViewer({
  modelUrl,
  modelType = "sog",
  debugLoading,
  debugError,
  mini = false,
  isRegenerating = false,
}: GaussianViewerProps) {
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerReady, setContainerReady] = useState(false);
  const [isLoadingInternal, setIsLoading] = useState(true);
  const [loadProgressInternal, setLoadProgress] = useState(0);
  const [errorInternal, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("scene");
  const [appReady, setAppReady] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Track when container is mounted
  useEffect(() => {
    if (containerRef.current) {
      setContainerReady(true);
    }
  }, []);

  // Debug overrides
  const isLoading =
    debugLoading !== undefined ? Boolean(debugLoading) : isLoadingInternal;
  const loadProgress =
    typeof debugLoading === "number" ? debugLoading : loadProgressInternal;
  const error =
    debugError !== undefined
      ? typeof debugError === "string"
        ? debugError
        : debugError
          ? "Debug error state"
          : null
      : errorInternal;

  // Handlers for splat loading
  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setLoadProgress(0);
    setError(null);
  }, []);

  const handleLoadComplete = useCallback(() => {
    setIsLoading(false);
    setLoadProgress(100);
  }, []);

  const handleLoadError = useCallback((err: Error) => {
    setError(err.message || "Failed to load 3D scene");
    setIsLoading(false);
  }, []);

  const handleLoadProgress = useCallback((progress: number) => {
    setLoadProgress(progress);
  }, []);

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = modelUrl;
    const ext =
      modelType === "sog" ? "sog" : modelType === "ply" ? "ply" : "glb";
    link.download = `scene.${ext}`;
    link.click();
  };

  const handleReset = () => {
    // Reset by incrementing reset key (triggers re-render for both viewers)
    if (modelType === "sog") {
      setAppReady(false);
      setTimeout(() => setAppReady(true), 100);
    } else {
      setResetKey((k) => k + 1);
    }
  };

  // Close modal on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isExpanded]);

  // Initialize app ready state
  useEffect(() => {
    if (modelUrl && !debugLoading && !debugError) {
      setAppReady(true);
    }
  }, [modelUrl, debugLoading, debugError]);

  // Use PLY viewer for PLY files (only after container is ready)
  usePlyViewer({
    modelUrl: modelType === "ply" && containerReady ? modelUrl : "",
    containerRef,
    onLoadStart: handleLoadStart,
    onLoadComplete: handleLoadComplete,
    onLoadError: handleLoadError,
    onLoadProgress: handleLoadProgress,
    mini,
    resetKey,
  });

  // Determine format type
  const isSogFormat = modelType === "sog";
  const isPlyFormat = modelType === "ply";
  const isSupportedFormat = isSogFormat || isPlyFormat;

  return (
    <>
      {/* Backdrop when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={handleCollapse}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        {/* Scene container - becomes modal when expanded, fills parent in mini mode */}
        <div
          ref={sceneContainerRef}
          className={`scene-container overflow-hidden ${
            mini
              ? "absolute inset-0"
              : isExpanded
                ? "expanded z-50"
                : "relative w-full aspect-[16/10]"
          }`}
        >
          {/* Viewer container */}
          <div
            ref={containerRef}
            className={`absolute inset-0 transition-transform duration-500 ${
              viewMode === "video" && !mini ? "scale-[2.5]" : "scale-100"
            }`}
          >
            {/* SOG Viewer (PlayCanvas) */}
            {appReady && isSogFormat && (
              <Application graphicsDeviceOptions={{ antialias: false }}>
                {/* Camera with orbit controls */}
                <Entity name="Camera" position={[0, 0, 3]}>
                  <Camera clearColor={new Color(0.1, 0.1, 0.1, 1)} />
                  {!mini && <CameraOrbitScript />}
                </Entity>

                {/* Splat model */}
                <SogSplatScene
                  modelUrl={modelUrl}
                  onLoadStart={handleLoadStart}
                  onLoadComplete={handleLoadComplete}
                  onLoadError={handleLoadError}
                  onLoadProgress={handleLoadProgress}
                />
              </Application>
            )}

            {/* PLY Viewer is handled by the usePlyViewer hook - it renders into containerRef */}

            {/* Fallback for unsupported formats */}
            {appReady && !isSupportedFormat && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)]">
                <p className="text-[var(--text-muted)] text-sm">
                  GLB/GLTF format not supported in this viewer. Please use SOG
                  or PLY format.
                </p>
              </div>
            )}
          </div>

          {/* Loading overlay - hidden in mini mode and when regenerating (keep scene visible) */}
          {isLoading && !mini && !isRegenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm z-10 ${
                isExpanded ? "bg-[#1a1a1a]/90" : "bg-[var(--surface)]/90"
              }`}
            >
              <p
                className={`text-lg font-medium mb-2 ${isExpanded ? "text-white" : ""}`}
              >
                Loading 3D Scene
              </p>
              <div
                className={`w-48 h-1.5 rounded-full overflow-hidden ${
                  isExpanded ? "bg-white/10" : "bg-[var(--surface-elevated)]"
                }`}
              >
                <motion.div
                  className={`h-full rounded-full ${isExpanded ? "bg-white" : "bg-[var(--accent)]"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${loadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p
                className={`text-sm mt-2 ${isExpanded ? "text-white/60" : "text-[var(--text-muted)]"}`}
              >
                {loadProgress}%
              </p>
            </motion.div>
          )}

          {/* Mini loading spinner */}
          {isLoading && mini && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-elevated)]">
              <div className="w-4 h-4 rounded-full border-2 border-[var(--text-muted)] border-t-transparent animate-spin" />
            </div>
          )}

          {/* Error overlay - hidden in mini mode */}
          {error && !mini && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm z-10 ${
                isExpanded ? "bg-[#1a1a1a]/90" : "bg-[var(--surface)]/90"
              }`}
            >
              <p className="text-lg font-medium mb-2 text-red-400">Error</p>
              <p
                className={`text-sm text-center max-w-sm ${
                  isExpanded ? "text-white/60" : "text-[var(--text-muted)]"
                }`}
              >
                {error}
              </p>
            </motion.div>
          )}

          {/* Regenerating overlay effect */}
          <AnimatePresence>
            {isRegenerating && !mini && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 z-30 pointer-events-none"
              >
                {/* Pulsing border glow */}
                <div className="absolute inset-0 rounded-2xl animate-regenerate-pulse" />

                {/* Updating badge */}
                <div
                  className={`absolute z-40 ${isExpanded ? "top-4 left-4" : "top-4 left-4"}`}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium ${
                      isExpanded
                        ? "bg-white/10 backdrop-blur-sm border border-white/20 text-white"
                        : "glass text-[var(--foreground)]"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    Regenerating...
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls overlay - hidden in mini mode */}
          {!isLoading && !error && !mini && (
            <>
              {/* Top right controls */}
              <div
                className={`absolute z-20 pointer-events-auto flex gap-2 ${
                  isExpanded ? "top-4 right-4" : "top-4 right-4"
                }`}
              >
                {/* Close button when expanded */}
                {isExpanded && (
                  <button
                    type="button"
                    onClick={handleCollapse}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all cursor-pointer"
                    title="Close"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                )}

                {/* Reset button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                  className={`flex items-center justify-center transition-all cursor-pointer ${
                    isExpanded
                      ? "w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20"
                      : "p-2.5 rounded-xl glass hover:bg-white/10"
                  }`}
                  title="Reset view"
                >
                  <RotateCcw
                    className={isExpanded ? "w-4 h-4 text-white" : "w-4 h-4"}
                  />
                </button>

                {/* Expand button when not expanded */}
                {!isExpanded && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExpand();
                    }}
                    className="p-2.5 rounded-xl glass hover:bg-white/10 transition-colors cursor-pointer"
                    title="Expand"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}

                {/* Download button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                  className={`flex items-center justify-center transition-all cursor-pointer ${
                    isExpanded
                      ? "w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20"
                      : "p-2.5 rounded-xl glass hover:bg-white/10"
                  }`}
                  title={`Download ${modelType.toUpperCase()}`}
                >
                  <Download
                    className={isExpanded ? "w-4 h-4 text-white" : "w-4 h-4"}
                  />
                </button>
              </div>

              {/* Bottom left instructions / video indicator */}
              <AnimatePresence mode="wait">
                {viewMode === "scene" ? (
                  <motion.div
                    key="instructions"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className={`absolute z-20 ${isExpanded ? "bottom-6 left-6" : "bottom-4 left-4"}`}
                  >
                    <div
                      className={`rounded-xl px-4 py-3 flex items-center gap-3 text-xs ${
                        isExpanded
                          ? "text-white/60 bg-white/10 backdrop-blur-sm border border-white/20"
                          : "glass text-[var(--text-muted)]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <MousePointer2 className="w-3.5 h-3.5" />
                        Drag to rotate
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Move3D className="w-3.5 h-3.5" />
                        Scroll to zoom
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="video-indicator"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className={`absolute z-20 ${isExpanded ? "bottom-6 left-6" : "bottom-4 left-4"}`}
                  >
                    <div
                      className={`rounded-xl px-4 py-3 flex items-center gap-3 text-xs ${
                        isExpanded
                          ? "bg-white/10 backdrop-blur-sm border border-white/20"
                          : "glass"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-red-400">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Video Preview
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom right Scene/Video toggle */}
              <div
                className={`absolute z-20 ${isExpanded ? "bottom-6 right-6" : "bottom-4 right-4"}`}
              >
                <div
                  className={`rounded-xl p-1 flex items-center gap-1 ${
                    isExpanded
                      ? "bg-white/10 backdrop-blur-sm border border-white/20"
                      : "glass"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setViewMode("scene")}
                    className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewMode === "scene"
                        ? isExpanded
                          ? "bg-white text-black"
                          : "bg-[var(--accent)] text-[var(--background)]"
                        : isExpanded
                          ? "text-white/60 hover:text-white hover:bg-white/10"
                          : "text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/5"
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    Scene
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("video")}
                    className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewMode === "video"
                        ? isExpanded
                          ? "bg-white text-black"
                          : "bg-[var(--accent)] text-[var(--background)]"
                        : isExpanded
                          ? "text-white/60 hover:text-white hover:bg-white/10"
                          : "text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/5"
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    Video
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}
