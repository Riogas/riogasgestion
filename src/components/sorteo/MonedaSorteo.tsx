"use client";

// La "moneda de fuego" de la raspadita: disco dorado con la llama RioGas
// adentro. Una sola fuente de verdad para la geometría, con dos salidas: SVG
// React (la moneda que descansa sobre el badge del foil y hace el gesto) y
// cursor custom para desktop. La moneda vive en DOM y no horneada en el
// canvas: así se anima y se desvanece sin repintar la lámina.

/**
 * Llama del logo simplificada como gota bezier, caja 28×32 px
 * (dirección visual §1c). También es la unidad del patrón del foil.
 */
export const LLAMA_PATH =
  "M14,0 C20,8 26,14 26,21 C26,28 20,32 14,32 C8,32 2,28 2,21 C2,14 8,8 14,0 Z";
export const LLAMA_W = 28;
export const LLAMA_H = 32;

const ORO_CLARO = "#FFD36B";
const ORO_OSCURO = "#FF9E3D";
const ORO_ARO = "#E2821A";
const LLAMA_MONEDA = "#B65E0F";

/** Escala para que la llama ocupe ~13px de alto dentro de la moneda de r=14. */
const ESCALA_LLAMA = 13 / LLAMA_H;

type MonedaSVGProps = {
  /** Lado del cuadrado en px (la moneda es un disco de r=14 en viewBox 32). */
  size?: number;
  className?: string;
};

/** La moneda como SVG (overlay de demo). Decorativa: siempre aria-hidden. */
export function MonedaSVG({ size = 32, className }: MonedaSVGProps) {
  const tx = 16 - (LLAMA_W * ESCALA_LLAMA) / 2;
  const ty = 16 - (LLAMA_H * ESCALA_LLAMA) / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="moneda-oro" cx="38%" cy="32%" r="80%">
          <stop offset="0%" stopColor={ORO_CLARO} />
          <stop offset="100%" stopColor={ORO_OSCURO} />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#moneda-oro)" stroke={ORO_ARO} strokeWidth="2" />
      <path
        d={LLAMA_PATH}
        transform={`translate(${tx} ${ty}) scale(${ESCALA_LLAMA})`}
        fill={LLAMA_MONEDA}
      />
    </svg>
  );
}

/**
 * Valor CSS `cursor` con la moneda de 32px (hotspot centrado) para desktop.
 * Se aplica por JS solo con `(pointer: fine)`: en touch no existe cursor.
 */
export function cursorMoneda(): string {
  const tx = (16 - (LLAMA_W * ESCALA_LLAMA) / 2).toFixed(2);
  const ty = (16 - (LLAMA_H * ESCALA_LLAMA) / 2).toFixed(2);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    `<defs><radialGradient id="g" cx="38%" cy="32%" r="80%">` +
    `<stop offset="0%" stop-color="${ORO_CLARO}"/>` +
    `<stop offset="100%" stop-color="${ORO_OSCURO}"/>` +
    `</radialGradient></defs>` +
    `<circle cx="16" cy="16" r="14" fill="url(#g)" stroke="${ORO_ARO}" stroke-width="2"/>` +
    `<path d="${LLAMA_PATH}" transform="translate(${tx} ${ty}) scale(${ESCALA_LLAMA.toFixed(4)})" fill="${LLAMA_MONEDA}"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, pointer`;
}
