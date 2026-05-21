/**
 * Concrete color values mirroring the CSS chart tokens defined in
 * `src/app/globals.css`. recharts, leaflet and other libs that expect
 * string color values cannot consume `var(--chart-N)` directly, so we
 * keep these constants in sync with the CSS layer.
 *
 * Keep in sync with:
 *   :root { --chart-1..5, --primary, --accent, ... }
 *   .dark { same vars, lifted variants }
 */
export const chartColors = {
  // Brand
  primary: "#1E5BB8",
  primaryDark: "#4F7DD9",
  accent: "#FF7A1A",
  accentDark: "#FF8C3D",

  // Secondary chart palette
  blueLight: "#3B82F6",
  blueLightDark: "#60A5FA",
  cyan: "#06B6D4",
  cyanDark: "#22D3EE",
  purple: "#8B5CF6",
  purpleDark: "#A78BFA",

  // Semantic
  success: "#10B981",
  warn: "#F59E0B",
  destructive: "#EF4444",

  // Neutral helpers for chart axes/grids (use sparingly — prefer CSS vars in JSX)
  borderLight: "#E4E8EE",
  borderDark: "#1E2740",
  mutedForegroundLight: "#5A6478",
  mutedForegroundDark: "#8693A8",
} as const;

export type ChartColorKey = keyof typeof chartColors;

/**
 * Theme-aware chart palette. Pass the resolved theme to get the right
 * variant. Default is "light".
 *
 * Usage:
 *   const palette = getChartPalette(resolvedTheme);
 *   <Area stroke={palette[1]} />
 */
export function getChartPalette(theme: "light" | "dark" = "light") {
  const isDark = theme === "dark";
  return {
    1: isDark ? chartColors.primaryDark : chartColors.primary,
    2: isDark ? chartColors.blueLightDark : chartColors.blueLight,
    3: isDark ? chartColors.accentDark : chartColors.accent,
    4: isDark ? chartColors.cyanDark : chartColors.cyan,
    5: isDark ? chartColors.purpleDark : chartColors.purple,
  } as const;
}

/**
 * Hook-less helper to read a CSS var at runtime. Useful when you need
 * the exact computed color (e.g., to pass to a canvas / SVG that won't
 * resolve `var()`). SSR-safe: returns empty string on the server.
 */
export function readChartCssVar(name: `--${string}`): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
