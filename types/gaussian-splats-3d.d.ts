declare module "@mkkellogg/gaussian-splats-3d" {
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
    dispose(): void;
  }
}
