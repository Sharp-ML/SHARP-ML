declare module "@mkkellogg/gaussian-splats-3d" {
  import * as THREE from "three";

  interface ViewerOptions {
    renderer?: THREE.WebGLRenderer;
    cameraUp?: [number, number, number];
    initialCameraPosition?: [number, number, number];
    initialCameraLookAt?: [number, number, number];
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
    dynamicScene?: boolean;
    sharedMemoryForWorkers?: boolean;
    rootElement?: HTMLElement;
    threeScene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    ignoreDevicePixelRatio?: boolean;
    halfPrecisionCovariancesOnGPU?: boolean;
    antialiased?: boolean;
    focalAdjustment?: number;
    sphericalHarmonicsDegree?: number;
    dropInMode?: boolean;
  }

  interface SplatSceneOptions {
    showLoadingUI?: boolean;
    progressiveLoad?: boolean;
    splatAlphaRemovalThreshold?: number;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    onProgress?: (progress: number, message: string, stage: string) => void;
  }

  interface SplatMesh extends THREE.Object3D {
    boundingBox?: THREE.Box3;
    getSplatCenter?(index: number): THREE.Vector3;
  }

  export class Viewer {
    constructor(options?: ViewerOptions);
    camera: THREE.PerspectiveCamera;
    splatMesh?: SplatMesh;
    controls?: {
      target?: THREE.Vector3;
      update?: () => void;
    };
    addSplatScene(url: string, options?: SplatSceneOptions): Promise<void>;
    dispose(): void;
    start(): void;
    stop(): void;
    setSize(width: number, height: number): void;
    update(): void;
    render(): void;
  }

  export class DropInViewer extends Viewer {
    constructor(options?: ViewerOptions);
  }

  export const SceneRevealMode: {
    Default: number;
    Gradual: number;
    Instant: number;
  };

  export const LogLevel: {
    None: number;
    Error: number;
    Warning: number;
    Info: number;
    Debug: number;
  };
}
