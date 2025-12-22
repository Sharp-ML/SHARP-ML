"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2,
  Download,
  Move3D,
  MousePointer2,
  Video,
  Box,
  X,
} from "lucide-react";
import { LayersIcon } from "@/components/ui/layers";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

type ViewMode = "scene" | "video";

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
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [isLoadingInternal, setIsLoading] = useState(true);
  const [loadProgressInternal, setLoadProgress] = useState(0);
  const [errorInternal, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("scene");
  const videoAnimationRef = useRef<{ startTime: number; active: boolean }>({ startTime: 0, active: false });
  const keysPressed = useRef<Set<string>>(new Set());

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

        if (disposed || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Create our own renderer for camera control
        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Create camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500);
        camera.position.set(0, 0, -3);
        camera.up.set(0, -1, 0);
        camera.lookAt(0, 0, 0);

        // Create controls for scene mode with improved settings
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1; // Smoother damping
        controls.rotateSpeed = 0.8; // Slightly slower for precision
        controls.enableZoom = true;
        controls.zoomSpeed = 1.2;
        controls.minDistance = 0.5; // Prevent zooming too close
        controls.maxDistance = 10; // Prevent zooming too far
        controls.enablePan = true; // Enable panning with right-click or shift+drag
        controls.panSpeed = 0.8;
        controls.screenSpacePanning = true; // Pan in screen space (more intuitive)
        controls.autoRotate = false;
        controls.target.set(0, 0, 0);
        // Limit vertical rotation to prevent disorientation
        controls.minPolarAngle = 0.1; // Prevent going fully overhead
        controls.maxPolarAngle = Math.PI - 0.1; // Prevent going fully under
        // Enable touch controls
        controls.touches = {
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        };
        controlsRef.current = controls;

        // Create viewer with our renderer and camera, manual mode
        const viewer = new GaussianSplats3D.Viewer({
          renderer: renderer,
          camera: camera,
          selfDrivenMode: false,
          useBuiltInControls: false,
          sharedMemoryForWorkers: false,
          dynamicScene: false,
          sceneRevealMode: GaussianSplats3D.SceneRevealMode.Gradual,
          antialiased: true,
          focalAdjustment: 1.0,
        });

        viewerRef.current = { viewer, camera, renderer, controls };

        await viewer.addSplatScene(modelUrl, {
          splatAlphaRemovalThreshold: 5,
          showLoadingUI: false,
          progressiveLoad: true,
          onProgress: (progress: number) => {
            // Progress is already 0-100, clamp to ensure valid percentage
            setLoadProgress(Math.min(100, Math.round(progress)));
          },
        });

        if (disposed) return;

        setIsLoading(false);

        // Animation loop with video mode support
        const animate = () => {
          if (disposed) return;
          animationFrameId = requestAnimationFrame(animate);
          
          // Check if we're in video mode
          if (videoAnimationRef.current.active) {
            const elapsed = (Date.now() - videoAnimationRef.current.startTime) / 1000;

            // Dynamic camera movement with orbiting and panning
            // Creates cinematic movement that showcases the 3D scene
            const orbitSpeed = 0.15; // Orbital rotation speed
            const panSpeed = 0.08; // Vertical pan speed
            const driftSpeed = 0.12; // Drift variation speed
            const baseDistance = 1.4; // Distance from center
            const orbitRadius = 0.4; // How far to move side to side
            const panAmount = 0.25; // Vertical movement range
            
            // Combine orbital motion with subtle drifting for organic movement
            const orbitAngle = elapsed * orbitSpeed;
            const x = Math.sin(orbitAngle) * orbitRadius + Math.sin(elapsed * driftSpeed * 1.3) * 0.1;
            const y = Math.sin(elapsed * panSpeed) * panAmount + Math.cos(elapsed * driftSpeed * 0.9) * 0.08;
            const z = -baseDistance + Math.cos(orbitAngle * 0.5) * 0.2 + Math.sin(elapsed * driftSpeed * 0.7) * 0.1;

            camera.position.set(x, y, z);
            camera.lookAt(0, 0, 0);

            controls.enabled = false;
          } else {
            controls.enabled = true;
            
            // Apply WASD keyboard controls
            const keys = keysPressed.current;
            const moveSpeed = 0.03;
            const rotateSpeed = 0.02;
            
            if (keys.size > 0) {
              // Get camera's forward and right vectors
              const forward = new THREE.Vector3();
              camera.getWorldDirection(forward);
              const right = new THREE.Vector3();
              right.crossVectors(forward, camera.up).normalize();
              
              // W/S - move forward/backward (dolly)
              if (keys.has('w')) {
                camera.position.addScaledVector(forward, moveSpeed);
                controls.target.addScaledVector(forward, moveSpeed);
              }
              if (keys.has('s')) {
                camera.position.addScaledVector(forward, -moveSpeed);
                controls.target.addScaledVector(forward, -moveSpeed);
              }
              
              // A/D - rotate around target (orbit left/right)
              if (keys.has('a')) {
                const angle = rotateSpeed;
                const offset = camera.position.clone().sub(controls.target);
                offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
                camera.position.copy(controls.target).add(offset);
              }
              if (keys.has('d')) {
                const angle = -rotateSpeed;
                const offset = camera.position.clone().sub(controls.target);
                offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
                camera.position.copy(controls.target).add(offset);
              }
              
              // Q/E - move up/down
              if (keys.has('q')) {
                camera.position.y -= moveSpeed;
                controls.target.y -= moveSpeed;
              }
              if (keys.has('e')) {
                camera.position.y += moveSpeed;
                controls.target.y += moveSpeed;
              }
            }
            
            controls.update();
          }
          
          // Update and render the Gaussian splats
          viewer.update();
          viewer.render();
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

      // Create controls with improved settings for easier navigation
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1; // Smoother damping
      controls.rotateSpeed = 0.8; // Slightly slower for precision
      controls.enableZoom = true;
      controls.zoomSpeed = 1.2;
      controls.minDistance = 0.5; // Prevent zooming too close
      controls.maxDistance = 15; // Prevent zooming too far
      controls.enablePan = true; // Enable panning with right-click or shift+drag
      controls.panSpeed = 0.8;
      controls.screenSpacePanning = true; // Pan in screen space (more intuitive)
      controls.autoRotate = false;
      controls.autoRotateSpeed = 1.0;
      // Limit vertical rotation to prevent disorientation
      controls.minPolarAngle = 0.1; // Prevent going fully overhead
      controls.maxPolarAngle = Math.PI - 0.1; // Prevent going fully under
      // Enable touch controls
      controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
      controlsRef.current = controls;

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

      // Animation loop with video mode support
      const animate = () => {
        if (disposed) return;
        animationFrameId = requestAnimationFrame(animate);
        
        // Check if we're in video mode
        if (videoAnimationRef.current.active) {
          const elapsed = (Date.now() - videoAnimationRef.current.startTime) / 1000;

          // Dynamic camera movement with orbiting and panning
          // Creates cinematic movement that showcases the 3D scene
          const orbitSpeed = 0.15; // Orbital rotation speed
          const panSpeed = 0.08; // Vertical pan speed
          const driftSpeed = 0.12; // Drift variation speed
          const baseDistance = 1.8; // Distance from center
          const orbitRadius = 0.5; // How far to move side to side
          const panAmount = 0.3; // Vertical movement range
          
          // Combine orbital motion with subtle drifting for organic movement
          const orbitAngle = elapsed * orbitSpeed;
          const x = Math.sin(orbitAngle) * orbitRadius + Math.sin(elapsed * driftSpeed * 1.3) * 0.12;
          const y = 0.8 + Math.sin(elapsed * panSpeed) * panAmount + Math.cos(elapsed * driftSpeed * 0.9) * 0.1;
          const z = baseDistance + Math.cos(orbitAngle * 0.5) * 0.25 + Math.sin(elapsed * driftSpeed * 0.7) * 0.1;

          camera.position.set(x, y, z);
          camera.lookAt(0, 0, 0);

          // Disable controls in video mode
          controls.enabled = false;
        } else {
          controls.enabled = true;
          
          // Apply WASD keyboard controls
          const keys = keysPressed.current;
          const moveSpeed = 0.05;
          const rotateSpeed = 0.02;
          
          if (keys.size > 0) {
            // Get camera's forward and right vectors
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            const right = new THREE.Vector3();
            right.crossVectors(forward, camera.up).normalize();
            
            // W/S - move forward/backward (dolly)
            if (keys.has('w')) {
              camera.position.addScaledVector(forward, moveSpeed);
              controls.target.addScaledVector(forward, moveSpeed);
            }
            if (keys.has('s')) {
              camera.position.addScaledVector(forward, -moveSpeed);
              controls.target.addScaledVector(forward, -moveSpeed);
            }
            
            // A/D - rotate around target (orbit left/right)
            if (keys.has('a')) {
              const angle = rotateSpeed;
              const offset = camera.position.clone().sub(controls.target);
              offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
              camera.position.copy(controls.target).add(offset);
            }
            if (keys.has('d')) {
              const angle = -rotateSpeed;
              const offset = camera.position.clone().sub(controls.target);
              offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
              camera.position.copy(controls.target).add(offset);
            }
            
            // Q/E - move up/down
            if (keys.has('q')) {
              camera.position.y -= moveSpeed;
              controls.target.y -= moveSpeed;
            }
            if (keys.has('e')) {
              camera.position.y += moveSpeed;
              controls.target.y += moveSpeed;
            }
          }
          
          controls.update();
        }
        
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

      // Dispose Gaussian Splat viewer (may be nested in object)
      if (viewerRef.current) {
        const viewerObj = viewerRef.current as { viewer?: { dispose: () => void }; dispose?: () => void };
        if (viewerObj.viewer?.dispose) {
          viewerObj.viewer.dispose();
        } else if (viewerObj.dispose) {
          viewerObj.dispose();
        }
      }

      // Dispose Three.js renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      // Dispose controls
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      viewerRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, [modelUrl, modelType]);

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = modelUrl;
    link.download = modelType === "ply" ? "scene.ply" : "model.glb";
    link.click();
  };

  // Handle resize when expanded/collapsed
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;

      if (newWidth === 0 || newHeight === 0) return;

      // Update renderer size
      rendererRef.current.setSize(newWidth, newHeight);

      // Update camera aspect ratio if we have a ThreeJS viewer
      const viewer = viewerRef.current as { camera?: THREE.PerspectiveCamera } | null;
      if (viewer?.camera) {
        viewer.camera.aspect = newWidth / newHeight;
        viewer.camera.updateProjectionMatrix();
      }
    };

    // Trigger resize after delays to catch CSS transitions
    const timeouts = [50, 100, 200, 300].map(delay => 
      setTimeout(handleResize, delay)
    );

    // Also listen to window resize while expanded
    if (isExpanded) {
      window.addEventListener("resize", handleResize);
    }

    return () => {
      timeouts.forEach(clearTimeout);
      window.removeEventListener("resize", handleResize);
    };
  }, [isExpanded]);

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

  // Handle view mode changes
  useEffect(() => {
    if (viewMode === "video") {
      videoAnimationRef.current = { startTime: Date.now(), active: true };
      // Disable controls when in video mode
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }
    } else {
      videoAnimationRef.current = { startTime: 0, active: false };
      // Re-enable controls when in scene mode
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    }
  }, [viewMode]);

  // WASD keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle WASD when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
        keysPressed.current.add(key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current.delete(key);
    };

    // Clear keys when window loses focus
    const handleBlur = () => {
      keysPressed.current.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

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
        {/* Scene container - becomes modal when expanded */}
        <div
          ref={sceneContainerRef}
          className={`scene-container overflow-hidden ${
            isExpanded
              ? "expanded z-50"
              : "relative w-full aspect-[16/10]"
          }`}
        >
          {/* Viewer container - scales up in video mode to crop edge artifacts */}
          <div
            ref={containerRef}
            className={`absolute inset-0 transition-transform duration-500 ${
              viewMode === "video" ? "scale-[2.5]" : "scale-100"
            }`}
          />

          {/* Loading overlay */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm z-10 ${
                isExpanded ? "bg-[#1a1a1a]/90" : "bg-[var(--surface)]/90"
              }`}
            >
              <p className={`text-lg font-medium mb-2 ${isExpanded ? "text-white" : ""}`}>
                Loading 3D Scene
              </p>
              <div className={`w-48 h-1.5 rounded-full overflow-hidden ${
                isExpanded ? "bg-white/10" : "bg-[var(--surface-elevated)]"
              }`}>
                <motion.div
                  className={`h-full rounded-full ${isExpanded ? "bg-white" : "bg-[var(--accent)]"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${loadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className={`text-sm mt-2 ${isExpanded ? "text-white/60" : "text-[var(--text-muted)]"}`}>
                {loadProgress}%
              </p>
            </motion.div>
          )}

          {/* Error overlay */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm z-10 ${
                isExpanded ? "bg-[#1a1a1a]/90" : "bg-[var(--surface)]/90"
              }`}
            >
              <p className="text-lg font-medium mb-2 text-red-400">Error</p>
              <p className={`text-sm text-center max-w-sm ${
                isExpanded ? "text-white/60" : "text-[var(--text-muted)]"
              }`}>
                {error}
              </p>
            </motion.div>
          )}

          {/* Controls overlay */}
          {!isLoading && !error && (
            <>
              {/* Top right controls */}
              <div className={`absolute z-20 pointer-events-auto flex gap-2 ${
                isExpanded ? "top-4 right-4" : "top-4 right-4"
              }`}>
                {/* Close button when expanded */}
                {isExpanded && (
                  <button
                    type="button"
                    onClick={handleCollapse}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all cursor-pointer"
                    title="Close"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                )}
                
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
                      ? "w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20"
                      : "p-2.5 rounded-xl glass hover:bg-white/10"
                  }`}
                  title={`Download ${modelType === "ply" ? "PLY" : "GLB"}`}
                >
                  <Download className={isExpanded ? "w-5 h-5 text-white" : "w-4 h-4"} />
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
                    <div className={`rounded-xl px-4 py-3 flex items-center gap-3 text-xs ${
                      isExpanded
                        ? "text-white/60 bg-white/10 backdrop-blur-sm border border-white/20"
                        : "glass text-[var(--text-muted)]"
                    }`}>
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
                    <div className={`rounded-xl px-4 py-3 flex items-center gap-3 text-xs ${
                      isExpanded
                        ? "bg-white/10 backdrop-blur-sm border border-white/20"
                        : "glass"
                    }`}>
                      <span className="flex items-center gap-2 text-red-400">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Video Preview
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom right Scene/Video toggle */}
              <div className={`absolute z-20 ${isExpanded ? "bottom-6 right-6" : "bottom-4 right-4"}`}>
                <div className={`rounded-xl p-1 flex items-center gap-1 ${
                  isExpanded
                    ? "bg-white/10 backdrop-blur-sm border border-white/20"
                    : "glass"
                }`}>
                  <button
                    type="button"
                    onClick={() => setViewMode("scene")}
                    className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewMode === "scene"
                        ? isExpanded
                          ? "bg-white text-black"
                          : "bg-[var(--accent)] text-white"
                        : isExpanded
                          ? "text-white/60 hover:text-white hover:bg-white/10"
                          : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
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
                          : "bg-[var(--accent)] text-white"
                        : isExpanded
                          ? "text-white/60 hover:text-white hover:bg-white/10"
                          : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
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
