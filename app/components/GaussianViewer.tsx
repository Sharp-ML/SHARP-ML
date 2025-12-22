"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Maximize2,
  Download,
  Move3D,
  MousePointer2,
} from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

interface GaussianViewerProps {
  modelUrl: string;
  modelType?: "ply" | "glb" | "gltf";
  /** Debug: Force loading state with optional progress (0-100) */
  debugLoading?: boolean | number;
  /** Debug: Force error state with optional message */
  debugError?: boolean | string;
}

export default function GaussianViewer({
  modelUrl,
  modelType = "glb",
  debugLoading,
  debugError,
}: GaussianViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [isLoadingInternal, setIsLoading] = useState(true);
  const [loadProgressInternal, setLoadProgress] = useState(0);
  const [errorInternal, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Debug overrides
  const isLoading = debugLoading !== undefined 
    ? Boolean(debugLoading) 
    : isLoadingInternal;
  const loadProgress = typeof debugLoading === "number" 
    ? debugLoading 
    : loadProgressInternal;
  const error = debugError !== undefined
    ? (typeof debugError === "string" ? debugError : debugError ? "Debug error state" : null)
    : errorInternal;

  useEffect(() => {
    // Skip initialization in debug mode
    if (debugLoading !== undefined || debugError !== undefined) return;
    if (!containerRef.current || !modelUrl) return;

    let disposed = false;
    let animationFrameId: number;

    const initViewer = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setLoadProgress(0);

        // Clear the container
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        if (modelType === "ply") {
          // Use Gaussian Splats viewer for PLY files
          await initGaussianSplatViewer();
        } else {
          // Use Three.js for GLB/GLTF files
          await initThreeJsViewer();
        }
      } catch (err) {
        console.error("Error initializing viewer:", err);
        if (!disposed) {
          setError(
            "Failed to load 3D scene. The model may still be processing."
          );
          setIsLoading(false);
        }
      }
    };

    const initGaussianSplatViewer = async () => {
      try {
        const GaussianSplats3D = await import("@mkkellogg/gaussian-splats-3d");

        if (disposed) return;

        const viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, -1, 0],
          initialCameraPosition: [0, 0, -3],
          initialCameraLookAt: [0, 0, 0],
          rootElement: containerRef.current,
          sharedMemoryForWorkers: false,
          dynamicScene: false,
          sceneRevealMode: GaussianSplats3D.SceneRevealMode.Gradual,
          antialiased: true,
          focalAdjustment: 1.0,
        });

        viewerRef.current = viewer;

        await (
          viewer as {
            addSplatScene: (url: string, options: object) => Promise<void>;
          }
        ).addSplatScene(modelUrl, {
          splatAlphaRemovalThreshold: 5,
          showLoadingUI: false,
          progressiveLoad: true,
          onProgress: (progress: number) => {
            setLoadProgress(Math.round(progress * 100));
          },
        });

        if (disposed) return;

        (viewer as { start: () => void }).start();
        setIsLoading(false);
      } catch (err) {
        throw err;
      }
    };

    const initThreeJsViewer = async () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a1a);

      // Create camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, 1, 3);

      // Create renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Create controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.0;

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(5, 10, 7.5);
      directionalLight.castShadow = true;
      scene.add(directionalLight);

      const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
      fillLight.position.set(-5, 0, -5);
      scene.add(fillLight);

      // Add environment
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envTexture = pmremGenerator.fromScene(
        new THREE.Scene()
      ).texture;
      scene.environment = envTexture;

      // Load GLB model
      const loader = new GLTFLoader();

      loader.load(
        modelUrl,
        (gltf) => {
          if (disposed) return;

          const model = gltf.scene;

          // Center and scale the model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());

          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2 / maxDim;
          model.scale.setScalar(scale);

          model.position.sub(center.multiplyScalar(scale));

          // Enable shadows
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          scene.add(model);
          viewerRef.current = { scene, camera, renderer, controls, model };

          setLoadProgress(100);
          setIsLoading(false);
        },
        (progress) => {
          if (progress.total > 0) {
            setLoadProgress(Math.round((progress.loaded / progress.total) * 100));
          }
        },
        (err) => {
          console.error("Error loading GLB:", err);
          if (!disposed) {
            setError("Failed to load 3D model");
            setIsLoading(false);
          }
        }
      );

      // Animation loop
      const animate = () => {
        if (disposed) return;
        animationFrameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (!containerRef.current || disposed) return;
        const newWidth = containerRef.current.clientWidth;
        const newHeight = containerRef.current.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };

      window.addEventListener("resize", handleResize);
    };

    initViewer();

    return () => {
      disposed = true;

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Dispose Gaussian Splat viewer
      if (
        viewerRef.current &&
        typeof (viewerRef.current as { dispose?: () => void }).dispose ===
          "function"
      ) {
        (viewerRef.current as { dispose: () => void }).dispose();
      }

      // Dispose Three.js renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      viewerRef.current = null;
      rendererRef.current = null;
    };
  }, [modelUrl, modelType]);

  const handleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = modelUrl;
    link.download = modelType === "ply" ? "scene.ply" : "model.glb";
    link.click();
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div className="scene-container relative aspect-[16/10] w-full">
        {/* Viewer container */}
        <div ref={containerRef} className="absolute inset-0" />

        {/* Loading overlay */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--surface)]/90 backdrop-blur-sm z-10"
          >
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] spin-slow" />
              <Move3D className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--accent)]" />
            </div>
            <p className="text-lg font-medium mb-2">Loading 3D Scene</p>
            <div className="w-48 h-1.5 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--accent)] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${loadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-2">
              {loadProgress}%
            </p>
          </motion.div>
        )}

        {/* Error overlay */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--surface)]/90 backdrop-blur-sm z-10"
          >
            <p className="text-lg font-medium mb-2 text-red-400">
              Error
            </p>
            <p className="text-sm text-[var(--text-muted)] text-center max-w-sm">
              {error}
            </p>
          </motion.div>
        )}

        {/* Controls overlay */}
        {!isLoading && !error && (
          <>
            {/* Top right controls */}
            <div className="absolute top-4 right-4 flex gap-2 z-20 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFullscreen();
                }}
                className="p-2.5 rounded-xl glass hover:bg-white/10 transition-colors cursor-pointer"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="p-2.5 rounded-xl glass hover:bg-white/10 transition-colors cursor-pointer"
                title={`Download ${modelType === "ply" ? "PLY" : "GLB"}`}
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom left instructions */}
            <div className="absolute bottom-4 left-4 z-20">
              <div className="glass rounded-xl px-4 py-3 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <MousePointer2 className="w-3.5 h-3.5" />
                  Drag to rotate
                </span>
                <span className="flex items-center gap-1.5">
                  <Move3D className="w-3.5 h-3.5" />
                  Scroll to zoom
                </span>
              </div>
            </div>

          </>
        )}
      </div>
    </motion.div>
  );
}
