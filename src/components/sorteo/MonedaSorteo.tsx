"use client";

// La "moneda de fuego" de la raspadita: disco dorado con la llama RioGas
// adentro. Una sola fuente de verdad para la geometría, con dos salidas: SVG
// React (la moneda que descansa sobre el badge del foil y hace el gesto) y
// cursor custom para desktop. La moneda vive en DOM y no horneada en el
// canvas: así se anima y se desvanece sin repintar la lámina.

/**
 * Llama del logo: mismo cuerpo que la unidad del patrón del foil
 * (`LLAMA_FOIL_PATH` en RaspaFoil), sin el vacío interior — a 13 px de alto
 * el hueco se cierra visualmente y solo ensucia el contorno. La punta
 * ganchuda y la muesca cóncava de la izquierda son las que la separan de una
 * gota de agua, que es lo que parecía la versión anterior.
 */
export const LLAMA_PATH =
  "M15,0 C13.4,3.6 10.2,7.4 7.4,11 C4.8,14.2 3.2,16.8 3.6,19.2 " +
  "C4,21 5.6,22 6.8,22.8 C4.6,23.4 2.2,25.4 2.2,27.6 " +
  "C2.2,31 5.8,33.6 10.6,33.6 C16.2,33.6 20.4,29.4 20.4,24.2 " +
  "C20.4,19 17.4,15.2 16.4,11.4 C15.4,7.8 15.2,3.6 15,0 Z";
export const LLAMA_W = 22;
export const LLAMA_H = 34;

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
