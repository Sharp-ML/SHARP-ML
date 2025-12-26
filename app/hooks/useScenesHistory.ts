"use client";

import { useState, useEffect, useCallback } from "react";

export interface SavedScene {
  id: string;
  name: string;
  imageUrl: string;
  modelUrl: string;
  modelType: "ply" | "glb" | "gltf";
  createdAt: string; // ISO date string from database
}

// Convert API response to SavedScene format
interface ApiScene {
  id: string;
  name: string;
  imageUrl: string;
  modelUrl: string;
  modelType: string;
  createdAt: string;
}

export function useScenesHistory() {
  const [scenes, setScenes] = useState<SavedScene[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch scenes from authenticated API on mount
  const fetchScenes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/scenes");

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated, just return empty scenes
          setScenes([]);
          return;
        }
        throw new Error("Failed to fetch scenes");
      }

      const data = await response.json();
      const fetchedScenes: SavedScene[] = (data.scenes || []).map(
        (scene: ApiScene) => ({
          id: scene.id,
          name: scene.name,
          imageUrl: scene.imageUrl,
          modelUrl: scene.modelUrl,
          modelType: scene.modelType as "ply" | "glb" | "gltf",
          createdAt: scene.createdAt,
        }),
      );

      setScenes(fetchedScenes);
    } catch (err) {
      console.error("Failed to fetch scenes:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch scenes");
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
    }
  }, []);

  // Fetch scenes on mount
  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  // Add a new scene (called after successful processing)
  // Note: This just refreshes the list since the API already created the scene
  const refreshScenes = useCallback(async () => {
    await fetchScenes();
  }, [fetchScenes]);

  // Remove a scene by ID
  const removeScene = useCallback(
    async (id: string) => {
      // Optimistically remove from UI
      setScenes((prev) => prev.filter((scene) => scene.id !== id));

      try {
        const response = await fetch(`/api/scenes/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          // Revert on error
          await fetchScenes();
          throw new Error("Failed to delete scene");
        }
      } catch (err) {
        console.error("Failed to delete scene:", err);
        setError(err instanceof Error ? err.message : "Failed to delete scene");
      }
    },
    [fetchScenes],
  );

  // Clear all scenes for this user
  const clearAllScenes = useCallback(async () => {
    const sceneIds = scenes.map((s) => s.id);

    // Optimistically clear
    setScenes([]);

    try {
      // Delete all scenes in parallel
      await Promise.all(
        sceneIds.map((id) => fetch(`/api/scenes/${id}`, { method: "DELETE" })),
      );
    } catch (err) {
      console.error("Failed to clear all scenes:", err);
      // Revert on error
      await fetchScenes();
    }
  }, [scenes, fetchScenes]);

  // Get a specific scene by ID
  const getScene = useCallback(
    (id: string) => {
      return scenes.find((scene) => scene.id === id);
    },
    [scenes],
  );

  // Update scene name
  const updateSceneName = useCallback(
    async (id: string, name: string) => {
      // Optimistically update
      setScenes((prev) =>
        prev.map((scene) => (scene.id === id ? { ...scene, name } : scene)),
      );

      try {
        const response = await fetch(`/api/scenes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });

        if (!response.ok) {
          // Revert on error
          await fetchScenes();
          throw new Error("Failed to update scene name");
        }
      } catch (err) {
        console.error("Failed to update scene name:", err);
      }
    },
    [fetchScenes],
  );

  return {
    scenes,
    isLoaded,
    isLoading,
    error,
    refreshScenes,
    removeScene,
    clearAllScenes,
    getScene,
    updateSceneName,
  };
}
