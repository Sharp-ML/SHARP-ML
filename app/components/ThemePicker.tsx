"use client";

import { useEffect, useRef, useState } from "react";
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
  const [activeTab, setActiveTab] = useState<Theme>("system");
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabElementRef = useRef<HTMLButtonElement>(null);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const stored = getStoredTheme();
    setActiveTab(stored);
    applyTheme(stored);

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

  // Update clip-path when active tab changes
  useEffect(() => {
    const container = containerRef.current;
    const activeTabElement = activeTabElementRef.current;

    if (activeTab && container && activeTabElement) {
      const { offsetLeft, offsetWidth } = activeTabElement;

      const clipLeft = offsetLeft;
      const clipRight = offsetLeft + offsetWidth;
      const containerWidth = container.offsetWidth;
      
      const leftPercent = (clipLeft / containerWidth) * 100;
      const rightPercent = 100 - (clipRight / containerWidth) * 100;
      
      container.style.clipPath = `inset(0 ${rightPercent.toFixed(1)}% 0 ${leftPercent.toFixed(1)}% round 6px)`;
    }
  }, [activeTab]);

  const handleThemeChange = (theme: Theme) => {
    setActiveTab(theme);
    localStorage.setItem("theme", theme);
    // Delay theme application to let clip-path animation start first
    requestAnimationFrame(() => {
      applyTheme(theme);
    });
  };

  return (
    <div className="theme-picker-wrapper">
      {/* Base layer - inactive buttons */}
      <ul className="theme-picker-list">
        {THEMES.map((theme) => (
          <li key={theme.id}>
            <button
              ref={activeTab === theme.id ? activeTabElementRef : null}
              data-tab={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className="theme-picker-button"
              aria-label={theme.label}
              title={theme.label}
            >
              {theme.icon}
            </button>
          </li>
        ))}
      </ul>

      {/* Overlay layer - active state with clip-path animation */}
      <div aria-hidden className="theme-picker-clip-container" ref={containerRef}>
        <ul className="theme-picker-list theme-picker-list-overlay">
          {THEMES.map((theme) => (
            <li key={theme.id}>
              <button
                data-tab={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className="theme-picker-button theme-picker-button-overlay"
                tabIndex={-1}
              >
                {theme.icon}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
