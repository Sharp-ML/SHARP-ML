declare module "@mkkellogg/gaussian-splats-3d" {
  import * as THREE from "three";

  export enum SceneRevealMode {
    Instant = 0,
    Gradual = 1,
  }

  export interface ViewerOptions {
    cameraUp?: [number, number, number];
    initialCameraPosition?: [number, number, number];
    initialCameraLookAt?: [number, number, number];
    rootElement?: HTMLElement | null;
    sharedMemoryForWorkers?: boolean;
    dynamicScene?: boolean;
    sceneRevealMode?: SceneRevealMode;
    antialiased?: boolean;
    focalAdjustment?: number;
    // Custom renderer and camera support
    renderer?: THREE.WebGLRenderer;
    camera?: THREE.PerspectiveCamera;
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
  }

  export interface SplatSceneOptions {
    splatAlphaRemovalThreshold?: number;
    showLoadingUI?: boolean;
    progressiveLoad?: boolean;
    onProgress?: (progress: number) => void;
  }

  export class Viewer {
    constructor(options: ViewerOptions);
    addSplatScene(url: string, options?: SplatSceneOptions): Promise<void>;
    start(): void;
    update(): void;
    render(): void;
    dispose(): void;
    scene: THREE.Scene;
  }
}
