import { useEffect, useState, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "goya:theme";
const LEGACY_KEY = "theme"; // preserved for migration

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  // Migrate legacy "theme" key (used by older Navbar.useTheme)
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy === "light" || legacy === "dark") return legacy;
  return "system";
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const resolved: ResolvedTheme = mode === "system" ? getSystemTheme() : mode;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

/**
 * Theme hook with 3 modes: light / dark / system.
 * - system mode follows prefers-color-scheme reactively
 * - persists to localStorage 'goya:theme' (back-compat with legacy 'theme')
 * - returns both the user-selected `mode` and the actually-applied `resolvedTheme`
 *
 * Back-compat: `theme` and `toggleTheme` keep working for existing call sites
 * (Navbar.tsx). `toggleTheme` cycles light → dark → light (skips system to keep
 * legacy click behavior); use `setMode` to access system mode explicitly.
 */
export function useTheme() {
  const [mounted, setMounted] = useState(false);
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    setMounted(true);
    const initial = readStoredMode();
    setModeState(initial);
    const resolved: ResolvedTheme = initial === "system" ? getSystemTheme() : initial;
    setResolvedTheme(resolved);
    applyTheme(initial);
  }, []);

  // Watch system preference when mode = system
  useEffect(() => {
    if (mode !== "system") return;
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next: ResolvedTheme = mql.matches ? "dark" : "light";
      setResolvedTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
      // Keep legacy key in sync so older code keeps working until removed
      if (next === "light" || next === "dark") {
        localStorage.setItem(LEGACY_KEY, next);
      } else {
        localStorage.removeItem(LEGACY_KEY);
      }
    }
    const resolved: ResolvedTheme = next === "system" ? getSystemTheme() : next;
    setResolvedTheme(resolved);
    applyTheme(next);
  }, []);

  // Cycle: light → dark → system → light
  const cycleMode = useCallback(() => {
    const next: ThemeMode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    setMode(next);
  }, [mode, setMode]);

  // Legacy 2-state toggle (light ↔ dark) — preserved for Navbar back-compat
  const toggleTheme = useCallback(() => {
    setMode(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setMode]);

  return {
    /** Back-compat: actually-applied theme (light|dark). Was the only thing exposed. */
    theme: resolvedTheme,
    /** User-selected mode (light|dark|system). */
    mode,
    /** Same as `theme` — explicit name for clarity. */
    resolvedTheme,
    /** Set the user-selected mode directly. */
    setMode,
    /** Cycle light → dark → system → light. */
    cycleMode,
    /** Legacy: toggle light↔dark. Used by existing Navbar. */
    toggleTheme,
    /** Has the hook initialized from storage yet? Useful to avoid hydration mismatch. */
    mounted,
  };
}
