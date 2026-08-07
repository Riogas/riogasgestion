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
import {
  cursorMoneda,
  LLAMA_H,
  LLAMA_PATH,
  LLAMA_W,
} from "@/components/sorteo/MonedaSorteo";

/** Cap del devicePixelRatio: @3x no aporta sobre una textura y come memoria iOS. */
const DPR_MAX = 2;
/** Radio del pincel en px CSS (equivale al lineWidth 44 de la dirección visual). */
const RADIO_PINCEL = 22;
/** Porcentaje despejado que dispara el auto-completado. */
const UMBRAL = 0.55;
/** Tope de trazos guardados para el replay tras resize/rotación. */
const MAX_TRAZOS = 20000;

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

/** Pinta la lámina completa (dirección visual §1, valores exactos). */
function pintarFoil(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fuente: string,
) {
  ctx.globalCompositeOperation = "source-over";

  // a) Base metálica azulada a 135° (plata con subtono del azul RioGas).
  const base = gradienteAngular(ctx, w, h, 135);
  base.addColorStop(0, "#AEBDD2");
  base.addColorStop(0.22, "#E7EDF5");
  base.addColorStop(0.45, "#BCC8DA");
  base.addColorStop(0.68, "#F2F5FA");
  base.addColorStop(1, "#A5B4CB");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // b) Banda de brillo estática a 115°: lo que hace que se lea "foil".
  const brillo = gradienteAngular(ctx, w, h, 115);
  brillo.addColorStop(0, "rgba(255,255,255,0)");
  brillo.addColorStop(0.48, "rgba(255,255,255,0.55)");
  brillo.addColorStop(0.54, "rgba(255,255,255,0.55)");
  brillo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = brillo;
  ctx.fillRect(0, 0, w, h);

  // c) Patrón de llamas en ladrillo (filas impares corridas, rotadas -8°,
  //    tintas azul/naranja alternadas por columna a opacidad de papel de
  //    seguridad).
  const llama = new Path2D(LLAMA_PATH);
  const rot = (-8 * Math.PI) / 180;
  const filas = Math.ceil(h / 34) + 1;
  const cols = Math.ceil(w / 54) + 1;
  for (let f = -1; f <= filas; f++) {
    const corrimiento = ((f % 2) + 2) % 2 === 1 ? 27 : 0;
    for (let c = -1; c <= cols; c++) {
      ctx.save();
      ctx.translate(c * 54 + corrimiento + LLAMA_W / 2, f * 34 + LLAMA_H / 2);
      ctx.rotate(rot);
      ctx.translate(-LLAMA_W / 2, -LLAMA_H / 2);
      ctx.fillStyle =
        ((c % 2) + 2) % 2 === 0
          ? "rgba(30,91,184,0.10)"
          : "rgba(255,122,26,0.10)";
      ctx.fill(llama);
      ctx.restore();
    }
  }

  // d) Grano metálico + destellos de 4 puntas.
  const rnd = mulberry32(0x5107ea5);
  for (let i = 0; i < 350; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    ctx.fillStyle =
      i % 2 === 0 ? "rgba(255,255,255,0.25)" : "rgba(30,91,184,0.06)";
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y);
    ctx.lineTo(x + 2.5, y);
    ctx.moveTo(x, y - 2.5);
    ctx.lineTo(x, y + 2.5);
    ctx.stroke();
  }

  // e) Viñeta física + línea de luz en el borde superior.
  const vineta = ctx.createRadialGradient(
    w / 2,
    h / 2,
    0,
    w / 2,
    h / 2,
    Math.hypot(w, h) / 2,
  );
  vineta.addColorStop(0, "rgba(11,18,32,0)");
  vineta.addColorStop(0.55, "rgba(11,18,32,0)");
  vineta.addColorStop(1, "rgba(11,18,32,0.10)");
  ctx.fillStyle = vineta;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(0, 0, w, 1);

  // f) Badge de affordance horneado (se borra al raspar): círculo blanco con
  //    "RASPÁ ACÁ" en la mitad de abajo. El hueco de arriba es para la moneda,
  //    que va en DOM encima del canvas: así puede hacer el gesto y desvanecerse
  //    al primer toque sin repintar el foil, y no hay dos monedas superpuestas.
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.shadowColor = "rgba(11,18,32,0.15)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
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
