"use client";

// Foil raspable de la raspadita: canvas 2D con la lámina metálica de marca
// (base azulada + banda de brillo + patrón de llamas + grano + viñeta +
// badge "RASPÁ ACÁ") que se agujerea con `destination-out` siguiendo el
// dedo (Pointer Events + captura + trazo interpolado con pincel suave).
//
// El progreso se mide con una grilla en JS marcada por cada estampa: cero
// `getImageData` en el hot path (clave en móviles de gama media). Este
// componente NO decide nada del sorteo: el resultado ya vino del backend;
// acá solo se avisa progreso/umbral y el padre coreografía el reveal.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cursorMoneda } from "@/components/sorteo/MonedaSorteo";

/**
 * Silueta de la llama del logo RioGas para el patrón del foil: ASIMÉTRICA
 * (punta inclinada a la derecha, hombro cargado, panza abajo) más la lengüeta
 * chica que el logo tiene abajo a la izquierda.
 *
 * No se reusa `LLAMA_PATH` de la moneda a propósito: esa es una gota bezier
 * simétrica y, repetida como textura, se leía literalmente como gotas de agua.
 * La moneda queda igual (ahí la gota funciona: va sola, chica y en oro).
 */
const LLAMA_FOIL_PATH =
  // Cuerpo. Las dos piezas que hacen que se lea FUEGO y no gota:
  //
  //  · La punta (15,0) está corrida al 68 % del ancho y sale ganchuda: el
  //    borde izquierdo arranca casi horizontal y recién después cae.
  //  · La MUESCA CÓNCAVA de la izquierda (x va 3.6 → 6.8 → 2.2 entre y=19 e
  //    y=27): es donde el logo separa la lengüeta chica del cuerpo. Una gota
  //    de agua tiene el contorno íntegramente convexo, así que una sola
  //    concavidad ya la descarta — a 14×21 px es la única señal que sobrevive.
  "M15,0 C13.4,3.6 10.2,7.4 7.4,11 C4.8,14.2 3.2,16.8 3.6,19.2 " +
  "C4,21 5.6,22 6.8,22.8 C4.6,23.4 2.2,25.4 2.2,27.6 " +
  "C2.2,31 5.8,33.6 10.6,33.6 C16.2,33.6 20.4,29.4 20.4,24.2 " +
  "C20.4,19 17.4,15.2 16.4,11.4 C15.4,7.8 15.2,3.6 15,0 Z " +
  // Vacío interior del logo (regla evenodd): convierte la silueta en anillo.
  "M11.6,22 C13.8,24 14.9,25.8 14.9,27.4 C14.9,29.4 13.4,30.7 11.5,30.7 " +
  "C9.6,30.7 8.1,29.4 8.1,27.4 C8.1,25.6 9.7,23.8 11.6,22 Z";
/** Caja de la llama: 22×34 (aspecto 0.65, bien vertical). */
const LLAMA_FOIL_W = 22;
const LLAMA_FOIL_H = 34;

/** Cap del devicePixelRatio: @3x no aporta sobre una textura y come memoria iOS. */
const DPR_MAX = 2;
/** Radio del pincel en px CSS (equivale al lineWidth 44 de la dirección visual). */
const RADIO_PINCEL = 22;
/** Porcentaje despejado que dispara el auto-completado. */
const UMBRAL = 0.55;
/** Tope de trazos guardados para el replay tras resize/rotación. */
const MAX_TRAZOS = 20000;
/** Ángulo (convención CSS) del laminado de la base y del cepillado del foil. */
const GRADOS_BASE = 152;

export type FoilRevelado = null | "ganador" | "sigue" | "corte";

/**
 * Mando imperativo del foil, para el raspado AUTOMÁTICO (el botón "Ver el
 * resultado sin raspar": la moneda hace el gesto sola, que es lo que pidió
 * el cliente). Se expone por un prop `apiRef` común y no por `ref`: React 18
 * no reenvía `ref` a componentes función sin `forwardRef`, y así el contrato
 * sobrevive igual cuando el proyecto pase a React 19.
 */
export type RaspaFoilApi = {
  /**
   * Raspa en coordenadas normalizadas 0..1 del foil. Con `continuo` interpola
   * desde el punto automático anterior (mismo trazo sin huecos).
   */
  raspar: (nx: number, ny: number, continuo: boolean) => void;
};

type Punto = { x: number; y: number };

type Grilla = {
  celdas: Uint8Array;
  cols: number;
  filas: number;
  celda: number;
  marcadas: number;
};

type Props = {
  /**
   * null mientras se raspa. Al setearse, el foil se congela y desvanece:
   * "ganador" 450ms ease-out-quart · "sigue" 600ms ease-in-out ·
   * "corte" instantáneo (prefers-reduced-motion).
   */
  revelado: FoilRevelado;
  /** Primer pointerdown sobre el foil (apagar moneda demo, haptic). */
  onPrimerTrazo: () => void;
  /** Porcentaje despejado 0..1, en cada movimiento (aritmética pura, barato). */
  onProgreso: (pct: number) => void;
  /** Se cruzó el umbral de auto-completado (una sola vez). */
  onUmbral: () => void;
  /** El canvas 2D no está disponible: el padre salta directo al resultado. */
  onCanvasRoto: () => void;
  /** Buzón donde se deja el mando imperativo del raspado automático. */
  apiRef?: MutableRefObject<RaspaFoilApi | null>;
};

/** PRNG determinístico: el grano del foil es idéntico en cada repintado. */
function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gradiente lineal centrado con ángulo en convención CSS (0° = arriba). */
function gradienteAngular(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  gradosCss: number,
): CanvasGradient {
  const rad = (gradosCss * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const largo = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return ctx.createLinearGradient(
    cx - dx * largo,
    cy - dy * largo,
    cx + dx * largo,
    cy + dy * largo,
  );
}

/** Pincel pre-renderizado (gradiente radial de alpha) a resolución nativa. */
function crearPincel(radio: number, dpr: number): HTMLCanvasElement | null {
  const d = Math.ceil(radio * 2 * dpr);
  const b = document.createElement("canvas");
  b.width = d;
  b.height = d;
  const bctx = b.getContext("2d");
  if (!bctx) return null;
  // Opaco hasta el 60% del radio, feather a transparente al 100% (§1).
  const g = bctx.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, d / 2);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.6, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  bctx.fillStyle = g;
  bctx.fillRect(0, 0, d, d);
  return b;
}

/**
 * Pinta la lámina completa.
 *
 * Lo que hace que una superficie se lea "metálica" y no "pastel" no es el
 * color: es el RANGO y la DUREZA de los saltos de luz. Un gradiente suave y
 * claro da plástico; el metal tiene la base oscura, muchos quiebres especulares
 * angostos y un highlight chico y filoso. Por eso acá la base baja hasta
 * #3F4E66 y las bandas de brillo son angostas en vez de una sábana blanca.
 */
function pintarFoil(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fuente: string,
) {
  ctx.globalCompositeOperation = "source-over";

  // a) Base de acero azulado: doce paradas con alternancia dura claro/oscuro.
  //    Son los "rolos" del laminado; con 5 paradas suaves la lámina se leía
  //    como un fondo celeste.
  //
  //    El ángulo (152°) es a propósito distinto del de las bandas especulares
  //    (115°): con los dos ejes casi paralelos las franjas se sumaban y salían
  //    dos "reflectores" blancos. Cruzados ~37° se modulan entre sí y dan el
  //    tornasol del foil.
  const base = gradienteAngular(ctx, w, h, GRADOS_BASE);
  const parada: ReadonlyArray<readonly [number, string]> = [
    [0.0, "#3E4D66"],
    [0.08, "#7284A1"],
    [0.16, "#4F6180"],
    [0.27, "#A8B8CE"],
    [0.35, "#5A6C89"],
    [0.46, "#8395B0"],
    [0.54, "#455670"],
    [0.66, "#B2C1D6"],
    [0.74, "#5F718D"],
    [0.84, "#8899B4"],
    [0.92, "#485972"],
    [1.0, "#3A4961"],
  ];
  for (const [p, c] of parada) base.addColorStop(p, c);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // b) Cepillado del laminado: líneas finas a lo largo del eje del gradiente.
  //    Le da dirección a la luz (el metal se "peina", el plástico no).
  const rnd = mulberry32(0x5107ea5);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  // El cepillado corre por el eje de la base (css 152° ⇒ canvas 62°).
  ctx.rotate(((GRADOS_BASE - 90) * Math.PI) / 180);
  const largo = Math.hypot(w, h);
  ctx.lineWidth = 1;
  for (let i = 0; i < 190; i++) {
    const y = (rnd() - 0.5) * largo;
    const claro = rnd() > 0.5;
    ctx.strokeStyle = claro
      ? `rgba(233,241,252,${0.05 + rnd() * 0.09})`
      : `rgba(24,36,56,${0.05 + rnd() * 0.09})`;
    ctx.beginPath();
    ctx.moveTo(-largo / 2, y);
    ctx.lineTo(largo / 2, y);
    ctx.stroke();
  }
  ctx.restore();

  // c) Micro-texto de seguridad en diagonal, como los billetes y las tarjetas
  //    de raspar reales. A 6px no se lee: se percibe como trama.
  //
  //    ORDEN IMPORTANTE: la trama y las llamas se graban ANTES de la luz. Con
  //    el highlight abajo, el micro-texto funcionaba como un velo gris sobre
  //    toda la lámina y le comía el contraste (se vio en la iteración v2).
  //    Grabado primero, la banda especular después le pasa por encima y todo
  //    queda bajo la misma luz, que es como se comporta un foil de verdad.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((-30 * Math.PI) / 180);
  ctx.font = `700 6px ${fuente}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const conEsp = "letterSpacing" in ctx;
  if (conEsp) ctx.letterSpacing = "1.4px";
  const cinta = "RIOGAS · ".repeat(14);
  for (let y = -largo / 2; y < largo / 2; y += 13) {
    // Filas alternadas corridas: la trama no forma columnas verticales.
    const off = Math.round(y / 13) % 2 === 0 ? 0 : 22;
    // Grabado: sombra abajo + luz arriba. Al 0.09 no se veía nada.
    ctx.fillStyle = "rgba(6,13,26,0.22)";
    ctx.fillText(cinta, -largo / 2 + off, y + 0.5);
    ctx.fillStyle = "rgba(255,255,255,0.17)";
    ctx.fillText(cinta, -largo / 2 + off, y - 0.5);
  }
  if (conEsp) ctx.letterSpacing = "0px";
  ctx.restore();

  // d) Patrón de llamas RioGas en ladrillo, CHICAS y densas: a tamaño completo
  //    eran seis stickers grandes; así se lee como trama. Tinta del propio
  //    metal: el naranja como relleno daba manchas marrones sobre el acero, así
  //    que el único acento cálido de la lámina son dos destellos en g).
  const llama = new Path2D(LLAMA_FOIL_PATH);
  // Un poco más grandes que en v4: con el hueco interior la silueta necesita
  // píxeles para leerse, y se compensa bajando la tinta (marca de agua).
  const esc = 0.62;
  const paso = { x: 26, y: 21 };
  const rot = (-8 * Math.PI) / 180;
  const filas = Math.ceil(h / paso.y) + 2;
  const cols = Math.ceil(w / paso.x) + 2;
  const grabar = (dx: number, dy: number, color: string) => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.scale(esc, esc);
    ctx.translate(-LLAMA_FOIL_W / 2, -LLAMA_FOIL_H / 2);
    ctx.fillStyle = color;
    // evenodd: el subpath interior tiene que salir como hueco, no relleno.
    ctx.fill(llama, "evenodd");
    ctx.restore();
  };
  for (let f = -1; f <= filas; f++) {
    const corr = ((f % 2) + 2) % 2 === 1 ? paso.x / 2 : 0;
    for (let c = -1; c <= cols; c++) {
      ctx.save();
      ctx.translate(c * paso.x + corr, f * paso.y);
      ctx.rotate(rot);
      // Relieve MUY plano: con el highlight fuerte cada llama se abultaba y
      // volvía a leerse como gota de agua sobre un vidrio. Acá es un grabado
      // seco, casi una marca de agua.
      grabar(-0.6, -0.6, "rgba(238,246,255,0.13)");
      grabar(0.6, 0.6, "rgba(11,22,40,0.14)");
      ctx.restore();
    }
  }

  // e) Highlight especular: DOS bandas ANGOSTAS a 115°, con núcleo duro. La
  //    original era una sábana blanca al 55 % que cubría media lámina — eso
  //    es exactamente lo que lavaba el gris azulado y daba el celeste pastel.
  const brillo = gradienteAngular(ctx, w, h, 115);
  brillo.addColorStop(0.0, "rgba(255,255,255,0)");
  brillo.addColorStop(0.28, "rgba(255,255,255,0)");
  brillo.addColorStop(0.305, "rgba(255,255,255,0.22)");
  brillo.addColorStop(0.325, "rgba(255,255,255,0.5)");
  brillo.addColorStop(0.337, "rgba(255,255,255,0.5)");
  brillo.addColorStop(0.358, "rgba(255,255,255,0.18)");
  brillo.addColorStop(0.4, "rgba(255,255,255,0)");
  brillo.addColorStop(0.52, "rgba(255,255,255,0)");
  // Glint fino y aislado: el detalle chico es lo que termina de vender el foil.
  brillo.addColorStop(0.545, "rgba(255,255,255,0.2)");
  brillo.addColorStop(0.553, "rgba(255,255,255,0)");
  brillo.addColorStop(0.68, "rgba(255,255,255,0)");
  brillo.addColorStop(0.705, "rgba(255,255,255,0.28)");
  brillo.addColorStop(0.72, "rgba(255,255,255,0.28)");
  brillo.addColorStop(0.75, "rgba(255,255,255,0)");
  brillo.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = brillo;
  ctx.fillRect(0, 0, w, h);

  // f) Contra-bandas oscuras pegadas al highlight: sin sombra propia el brillo
  //    no se lee como reflejo sino como pintura blanca encima.
  const sombra = gradienteAngular(ctx, w, h, 115);
  sombra.addColorStop(0.0, "rgba(13,22,38,0.3)");
  sombra.addColorStop(0.16, "rgba(13,22,38,0.34)");
  sombra.addColorStop(0.28, "rgba(13,22,38,0)");
  sombra.addColorStop(0.42, "rgba(13,22,38,0.06)");
  sombra.addColorStop(0.53, "rgba(13,22,38,0.34)");
  sombra.addColorStop(0.62, "rgba(13,22,38,0.16)");
  sombra.addColorStop(0.68, "rgba(13,22,38,0)");
  sombra.addColorStop(0.79, "rgba(13,22,38,0.14)");
  sombra.addColorStop(0.9, "rgba(13,22,38,0.36)");
  sombra.addColorStop(1.0, "rgba(13,22,38,0.3)");
  ctx.fillStyle = sombra;
  ctx.fillRect(0, 0, w, h);

  // g) Grano metálico + destellos de 4 puntas.
  for (let i = 0; i < 520; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    ctx.fillStyle =
      i % 2 === 0 ? "rgba(255,255,255,0.34)" : "rgba(12,22,40,0.24)";
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    // Dos de los catorce destellos en ámbar: es TODO el naranja que queda en
    // la lámina, y entra como luz reflejada (que es como el metal toma color),
    // no como tinta.
    ctx.strokeStyle =
      i % 7 === 3 ? "rgba(255,186,120,0.85)" : "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y);
    ctx.lineTo(x + 2.5, y);
    ctx.moveTo(x, y - 2.5);
    ctx.lineTo(x, y + 2.5);
    ctx.stroke();
  }

  // h) Viñeta física + línea de luz en el borde superior y sombra en el de
  //    abajo: la lámina se lee como algo APOYADO sobre la tarjeta.
  const vineta = ctx.createRadialGradient(
    w / 2,
    h / 2,
    0,
    w / 2,
    h / 2,
    Math.hypot(w, h) / 2,
  );
  vineta.addColorStop(0, "rgba(8,14,26,0)");
  vineta.addColorStop(0.5, "rgba(8,14,26,0.04)");
  vineta.addColorStop(1, "rgba(8,14,26,0.24)");
  ctx.fillStyle = vineta;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(0, 0, w, 1);
  ctx.fillStyle = "rgba(8,14,26,0.28)";
  ctx.fillRect(0, h - 1, w, 1);

  // f) Badge de affordance horneado (se borra al raspar): círculo blanco con
  //    "RASPÁ ACÁ" en la mitad de abajo. El hueco de arriba es para la moneda,
  //    que va en DOM encima del canvas: así puede hacer el gesto y desvanecerse
  //    al primer toque sin repintar el foil, y no hay dos monedas superpuestas.
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  // Sombra más marcada que antes: sobre el metal oscuro el disco tiene que
  // leerse apoyado encima, y el blanco casi pleno mantiene el contraste del
  // texto azul (que sobre la lámina nueva mejoró, no empeoró).
  ctx.shadowColor = "rgba(6,12,24,0.45)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#1E5BB8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 13px ${fuente}`;
  const conEspaciado = "letterSpacing" in ctx;
  if (conEspaciado) ctx.letterSpacing = "2.6px";
  // +1.3px: el letter-spacing agrega espacio tras el último glifo y el
  // centrado quedaría corrido medio espaciado a la izquierda.
  const corr = conEspaciado ? 1.3 : 0;
  ctx.fillText("RASPÁ", cx + corr, cy + 10);
  ctx.fillText("ACÁ", cx + corr, cy + 26);
  if (conEspaciado) ctx.letterSpacing = "0px";
}

export default function RaspaFoil({
  revelado,
  onPrimerTrazo,
  onProgreso,
  onUmbral,
  onCanvasRoto,
  apiRef,
}: Props) {
  const contRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Estado "caliente" en refs: cero setState en el camino del pointermove.
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const pincelRef = useRef<HTMLCanvasElement | null>(null);
  const tamRef = useRef({ w: 0, h: 0 });
  const rectRef = useRef<DOMRect | null>(null);
  const dibujandoRef = useRef(false);
  const ultimoRef = useRef<Punto | null>(null);
  /** Último punto del raspado AUTOMÁTICO (independiente del dedo). */
  const ultimoAutoRef = useRef<Punto | null>(null);
  /** Trazos en coordenadas normalizadas 0..1 para replay tras resize. */
  const trazosRef = useRef<Array<[number, number]>>([]);
  const grillaRef = useRef<Grilla | null>(null);
  const congeladoRef = useRef(false);
  const umbralAvisadoRef = useRef(false);
  const primerTrazoRef = useRef(false);

  // Los callbacks del padre son arrows inline: se leen vía ref para que el
  // effect de setup no se re-corra en cada render del padre.
  const avisosRef = useRef({ onPrimerTrazo, onProgreso, onUmbral, onCanvasRoto });
  useEffect(() => {
    avisosRef.current = { onPrimerTrazo, onProgreso, onUmbral, onCanvasRoto };
  });

  useEffect(() => {
    if (revelado !== null) congeladoRef.current = true;
  }, [revelado]);

  const marcarGrilla = useCallback((x: number, y: number) => {
    const g = grillaRef.current;
    if (!g || g.celdas.length === 0) return;
    // Radio interno: compensa el borde suave del pincel (no borra al 100%).
    const rr = RADIO_PINCEL * 0.8;
    const c0 = Math.max(0, Math.floor((x - rr) / g.celda));
    const c1 = Math.min(g.cols - 1, Math.floor((x + rr) / g.celda));
    const f0 = Math.max(0, Math.floor((y - rr) / g.celda));
    const f1 = Math.min(g.filas - 1, Math.floor((y + rr) / g.celda));
    for (let f = f0; f <= f1; f++) {
      for (let c = c0; c <= c1; c++) {
        const dx = (c + 0.5) * g.celda - x;
        const dy = (f + 0.5) * g.celda - y;
        if (dx * dx + dy * dy > rr * rr) continue;
        const i = f * g.cols + c;
        if (!g.celdas[i]) {
          g.celdas[i] = 1;
          g.marcadas++;
        }
      }
    }
  }, []);

  const estampar = useCallback(
    (x: number, y: number, registrar = true) => {
      const ctx = ctxRef.current;
      const pincel = pincelRef.current;
      if (!ctx || !pincel) return;
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(
        pincel,
        x - RADIO_PINCEL,
        y - RADIO_PINCEL,
        RADIO_PINCEL * 2,
        RADIO_PINCEL * 2,
      );
      marcarGrilla(x, y);
      if (registrar && trazosRef.current.length < MAX_TRAZOS) {
        const { w, h } = tamRef.current;
        if (w > 0 && h > 0) trazosRef.current.push([x / w, y / h]);
      }
    },
    [marcarGrilla],
  );

  /** Interpola entre puntos: sin huecos aunque el swipe vaya a 2000 px/s. */
  const estamparLinea = useCallback(
    (desde: Punto, hasta: Punto) => {
      const dx = hasta.x - desde.x;
      const dy = hasta.y - desde.y;
      const pasos = Math.max(
        1,
        Math.ceil(Math.hypot(dx, dy) / (RADIO_PINCEL * 0.4)),
      );
      for (let i = 1; i <= pasos; i++) {
        estampar(desde.x + (dx * i) / pasos, desde.y + (dy * i) / pasos);
      }
    },
    [estampar],
  );

  const reportarProgreso = useCallback(() => {
    const g = grillaRef.current;
    if (!g || g.celdas.length === 0) return;
    const pct = g.marcadas / g.celdas.length;
    avisosRef.current.onProgreso(pct);
    if (pct >= UMBRAL && !umbralAvisadoRef.current) {
      umbralAvisadoRef.current = true;
      congeladoRef.current = true;
      avisosRef.current.onUmbral();
    }
  }, []);

  // Mando del raspado automático: el padre lo maneja con rAF y mueve la
  // moneda por el mismo camino, así el trazo y la moneda van sincronizados.
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      raspar: (nx, ny, continuo) => {
        if (congeladoRef.current) return;
        const { w, h } = tamRef.current;
        if (w <= 0 || h <= 0) return;
        const p = { x: nx * w, y: ny * h };
        if (continuo && ultimoAutoRef.current) {
          estamparLinea(ultimoAutoRef.current, p);
        } else {
          estampar(p.x, p.y);
        }
        ultimoAutoRef.current = p;
        reportarProgreso();
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, estampar, estamparLinea, reportarProgreso]);

  // ---- Setup del canvas: idempotente (StrictMode) y con replay en resize ----
  useLayoutEffect(() => {
    const cont = contRef.current;
    const canvas = canvasRef.current;
    if (!cont || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // iOS bajo presión de memoria puede devolver null: sin foil no se
      // tapa nada, el padre revela directo.
      avisosRef.current.onCanvasRoto();
      return;
    }
    ctxRef.current = ctx;

    const setup = () => {
      const { width, height } = cont.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
      canvas.width = Math.round(width * dpr); // borra + resetea el contexto
      canvas.height = Math.round(height * dpr);
      // setTransform (no scale): idempotente si se re-ejecuta.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tamRef.current = { w: width, h: height };
      rectRef.current = null;
      pincelRef.current = crearPincel(RADIO_PINCEL, dpr);
      const celda = Math.max(8, RADIO_PINCEL * 0.75);
      const cols = Math.ceil(width / celda);
      const filas = Math.ceil(height / celda);
      grillaRef.current = {
        celdas: new Uint8Array(cols * filas),
        cols,
        filas,
        celda,
        marcadas: 0,
      };
      const fuente = getComputedStyle(cont).fontFamily || "system-ui, sans-serif";
      pintarFoil(ctx, width, height, fuente);
      // Replay de lo ya raspado: rotar el teléfono no regala ni borra avance.
      for (const [nx, ny] of trazosRef.current) {
        estampar(nx * width, ny * height, false);
      }
    };

    setup();

    if (window.matchMedia?.("(pointer: fine)").matches) {
      canvas.style.cursor = cursorMoneda();
    }

    let debounce = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        const { width, height } = cont.getBoundingClientRect();
        const { w, h } = tamRef.current;
        // La URL bar móvil dispara resizes de ruido: se ignoran deltas <1px.
        if (Math.abs(width - w) < 1 && Math.abs(height - h) < 1) return;
        setup();
        reportarProgreso();
      }, 150);
    });
    ro.observe(cont);

    return () => {
      ro.disconnect();
      window.clearTimeout(debounce);
      // Libera el backing store YA (WebKit/iOS no espera al GC).
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [estampar, reportarProgreso]);

  // ---- Input unificado (mouse + touch + stylus) ----
  const aLocal = useCallback((cx: number, cy: number): Punto => {
    const rect =
      rectRef.current ?? canvasRef.current?.getBoundingClientRect() ?? null;
    if (!rect) return { x: cx, y: cy };
    return { x: cx - rect.left, y: cy - rect.top };
  }, []);

  const alBajar = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (congeladoRef.current || !e.isPrimary) return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointerId inactivo (tests/edge): se raspa igual sin captura */
      }
      rectRef.current = e.currentTarget.getBoundingClientRect();
      dibujandoRef.current = true;
      if (!primerTrazoRef.current) {
        primerTrazoRef.current = true;
        avisosRef.current.onPrimerTrazo();
      }
      const p = aLocal(e.clientX, e.clientY);
      estampar(p.x, p.y);
      ultimoRef.current = p;
      reportarProgreso();
    },
    [aLocal, estampar, reportarProgreso],
  );

  const alMover = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!dibujandoRef.current || congeladoRef.current) return;
      const ne = e.nativeEvent;
      // Los pointermove llegan alineados a rAF pero el hardware muestrea a
      // 120-240Hz: sin los coalesced un swipe rápido queda anguloso.
      const crudos =
        typeof ne.getCoalescedEvents === "function"
          ? ne.getCoalescedEvents()
          : [];
      const eventos = crudos.length > 0 ? crudos : [ne];
      for (const ev of eventos) {
        const p = aLocal(ev.clientX, ev.clientY);
        if (ultimoRef.current) estamparLinea(ultimoRef.current, p);
        else estampar(p.x, p.y);
        ultimoRef.current = p;
      }
      reportarProgreso();
    },
    [aLocal, estampar, estamparLinea, reportarProgreso],
  );

  // pointercancel es obligatorio: iOS/Android lo tiran cuando el sistema se
  // roba el gesto (notificación, swipe de borde). Sin esto, el próximo move
  // dibujaría sin dedo abajo.
  const finTrazo = useCallback(() => {
    dibujandoRef.current = false;
    ultimoRef.current = null;
  }, []);

  const estiloFade: CSSProperties =
    revelado === null
      ? {}
      : {
          opacity: 0,
          pointerEvents: "none",
          transition:
            revelado === "ganador"
              ? "opacity 450ms cubic-bezier(0.25,1,0.5,1)"
              : revelado === "sigue"
                ? "opacity 600ms cubic-bezier(0.4,0,0.2,1)"
                : "none",
        };

  return (
    <div ref={contRef} className="absolute inset-0">
      {/* Puramente gestual: el control accesible es el botón del padre. */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="raspa-canvas absolute inset-0 h-full w-full"
        style={estiloFade}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={finTrazo}
        onPointerCancel={finTrazo}
        onLostPointerCapture={finTrazo}
      />
    </div>
  );
}
