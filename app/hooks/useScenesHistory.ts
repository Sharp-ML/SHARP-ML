"use client";

import { useState, useEffect, useCallback } from "react";

export interface SavedScene {
  id: string;
  name: string;
  previewUrl: string; // base64 data URL of the original image
  imageUrl?: string; // Vercel Blob URL for shareable previews
  modelUrl: string;
  modelType: "ply" | "glb" | "gltf";
  createdAt: number;
}

const STORAGE_KEY = "apple-sharp-scenes";
const MAX_SCENES = 20; // Limit to prevent localStorage bloat

export function useScenesHistory() {
  const [scenes, setScenes] = useState<SavedScene[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load scenes from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedScene[];
        // Sort by createdAt descending (newest first)
        setScenes(parsed.sort((a, b) => b.createdAt - a.createdAt));
      }
    } catch (error) {
      console.error("Failed to load scenes from localStorage:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save scenes to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes));
    } catch (error) {
      console.error("Failed to save scenes to localStorage:", error);
      // If storage is full, try removing oldest scenes
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        const trimmedScenes = scenes.slice(0, Math.floor(scenes.length / 2));
        setScenes(trimmedScenes);
      }
    }
  }, [scenes, isLoaded]);

  const addScene = useCallback(
    (scene: Omit<SavedScene, "id" | "createdAt">) => {
      const newScene: SavedScene = {
        ...scene,
        id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: Date.now(),
      };

      setScenes((prev) => {
        // Add new scene at the beginning, limit total scenes
        const updated = [newScene, ...prev].slice(0, MAX_SCENES);
        return updated;
      });

      return newScene.id;
    },
    []
  );

  const removeScene = useCallback((id: string) => {
    setScenes((prev) => prev.filter((scene) => scene.id !== id));
  }, []);

  const clearAllScenes = useCallback(() => {
    setScenes([]);
  }, []);

  const getScene = useCallback(
    (id: string) => {
      return scenes.find((scene) => scene.id === id);
    },
    [scenes]
  );

  const updateSceneName = useCallback((id: string, name: string) => {
    setScenes((prev) =>
      prev.map((scene) => (scene.id === id ? { ...scene, name } : scene))
    );
  }, []);

  return {
    scenes,
    isLoaded,
    addScene,
    removeScene,
    clearAllScenes,
    getScene,
    updateSceneName,
  };
}
