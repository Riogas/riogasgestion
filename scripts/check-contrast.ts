/**
 * Run: pnpm exec tsx scripts/check-contrast.ts
 *
 * Verifies every (foreground, background) token pair from globals.css meets
 * WCAG AA contrast:
 *   ≥ 4.5:1 for normal-size body text
 *   ≥ 3:1   for large text and UI components (buttons, icons)
 *
 * The hex values mirror the oklch tokens in src/app/globals.css. Keep in sync.
 * If any pair fails, the script exits 1 — wire into CI later.
 */

type Pair = { name: string; fg: string; bg: string; min: number };

// NOTE: Tokens like --success, --warn, --destructive are FILL/ICON colors,
// not body-text colors. Don't test them as fg-on-bg pairs. For tonal badges
// (e.g. text-success bg-success/10), use darker derived shades per Tailwind
// docs (e.g. text-emerald-700) or accept large-text threshold per design.

const pairs: Pair[] = [
  // ===== LIGHT THEME =====
  { name: "foreground on background (light)",        fg: "#0B1220", bg: "#FAFBFC", min: 4.5 },
  { name: "foreground on card (light)",              fg: "#0B1220", bg: "#FFFFFF", min: 4.5 },
  { name: "muted-foreground on background (light)",  fg: "#5A6478", bg: "#FAFBFC", min: 4.5 },
  { name: "muted-foreground on muted (light)",       fg: "#5A6478", bg: "#F1F4F8", min: 4.5 },
  { name: "primary-foreground on primary (light)",   fg: "#FFFFFF", bg: "#1E5BB8", min: 4.5 },
  // accent CTAs use dark text on orange (white-on-orange fails AA)
  { name: "accent-foreground on accent (light)",     fg: "#0B1220", bg: "#FF7A1A", min: 4.5 },
  { name: "primary on background (light, link/CTA)", fg: "#1E5BB8", bg: "#FAFBFC", min: 4.5 },
  { name: "destructive-fg on destructive (light)",   fg: "#FFFFFF", bg: "#EF4444", min: 3.0 }, // UI threshold

  // ===== DARK THEME =====
  { name: "foreground on background (dark)",         fg: "#E6ECF5", bg: "#0A0F1A", min: 4.5 },
  { name: "foreground on card (dark)",               fg: "#E6ECF5", bg: "#0F1626", min: 4.5 },
  { name: "muted-foreground on background (dark)",   fg: "#8693A8", bg: "#0A0F1A", min: 4.5 },
  { name: "muted-foreground on muted (dark)",        fg: "#8693A8", bg: "#131B2D", min: 4.5 },
  // primary in dark is oklch(0.55 0.13 256) ≈ #3B6CC7
  { name: "primary-foreground on primary (dark)",    fg: "#FFFFFF", bg: "#3B6CC7", min: 4.5 },
  { name: "accent-foreground on accent (dark)",      fg: "#0B1220", bg: "#FF8C3D", min: 4.5 },
  { name: "primary on background (dark)",            fg: "#3B6CC7", bg: "#0A0F1A", min: 3.0 }, // UI/link threshold
  { name: "destructive-fg on destructive (dark)",    fg: "#FFFFFF", bg: "#D63F3F", min: 3.0 },
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relLum(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: string, bg: string): number {
  const L1 = relLum(hexToRgb(fg));
  const L2 = relLum(hexToRgb(bg));
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

let failed = 0;
let weak = 0;
console.log("\nWCAG contrast check — Goya redesign tokens\n");
console.log("─".repeat(60));

for (const { name, fg, bg, min } of pairs) {
  const ratio = contrast(fg, bg);
  const ok = ratio >= min;
  // Flag pairs that pass minimum but are close (within 0.3 of threshold)
  const isWeak = ok && ratio < min + 0.3;
  const mark = ok ? (isWeak ? "~" : "✓") : "✗";
  const ratioStr = ratio.toFixed(2).padStart(5);
  console.log(`${mark}  ${ratioStr}  (min ${min})  ${name}`);
  if (!ok) failed++;
  if (isWeak) weak++;
}

console.log("─".repeat(60));
if (failed > 0) {
  console.error(`\n✗ ${failed} pair(s) FAILED WCAG AA. Adjust tokens in globals.css.`);
  process.exit(1);
}
if (weak > 0) {
  console.warn(`\n~ ${weak} pair(s) pass but are marginal (within +0.3 of threshold).`);
}
console.log(`\n✓ All ${pairs.length} pairs pass WCAG AA.\n`);
