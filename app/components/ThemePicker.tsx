"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

const THEMES: { id: Theme; icon: React.ReactNode; label: string }[] = [
  { id: "light", icon: <Sun className="w-3.5 h-3.5" strokeWidth={1.5} />, label: "Light" },
  { id: "dark", icon: <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />, label: "Dark" },
  { id: "system", icon: <Monitor className="w-3.5 h-3.5" strokeWidth={1.5} />, label: "System" },
];

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem("theme") as Theme | null;
  return stored || "system";
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const effectiveTheme = theme === "system" ? getSystemTheme() : theme;
  
  // Disable transitions during theme change
  document.documentElement.classList.add("theme-transitioning");
  document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
  
  // Re-enable transitions after the theme has been applied
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("theme-transitioning");
    });
  });
}

export function ThemePicker() {
  const [activeTab, setActiveTab] = useState<Theme | null>(null);
  // Track if we've completed initial mount to enable transitions
  const [hasMounted, setHasMounted] = useState(false);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const stored = getStoredTheme();
    setActiveTab(stored);
    applyTheme(stored);

    // Enable transitions after initial render (next frame)
    requestAnimationFrame(() => {
      setHasMounted(true);
    });

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const current = getStoredTheme();
      if (current === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const handleThemeChange = (theme: Theme) => {
    setActiveTab(theme);
    localStorage.setItem("theme", theme);
    applyTheme(theme);
  };

  return (
    <div className={`theme-picker-wrapper ${hasMounted ? "theme-picker-ready" : ""}`}>
      <ul className="theme-picker-list">
        {THEMES.map((theme) => (
          <li key={theme.id}>
            <button
              onClick={() => handleThemeChange(theme.id)}
              className={`theme-picker-button ${activeTab === theme.id ? "theme-picker-button-active" : ""}`}
              aria-label={theme.label}
              title={theme.label}
            >
              {theme.icon}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
