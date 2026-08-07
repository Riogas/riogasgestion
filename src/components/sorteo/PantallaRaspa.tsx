"use client";

// Pantalla de RASPADITA: el paso intermedio entre el submit y el resultado.
// El backend YA resolvió ganador/sigue antes de montarla — acá solo se revela,
// nunca se decide. Compone la ventana troquelada (foil raspable arriba,
// "resultado compacto" abajo), la moneda que enseña el gesto y el camino
// accesible ("Ver el resultado sin raspar": la moneda raspa sola en ~2 s, que
// es literalmente lo que pidió el cliente).
//
// Las dos variantes del compacto comparten la MISMA silueta (círculo con
// ícono, línea grande, línea chica) para que raspar una esquinita no delate el
// resultado por la forma. El compacto del ganador NO muestra el código de
// canje: eso es exclusivo de la pantalla completa que viene después.
import confetti from "canvas-confetti";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { Flame, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MonedaSVG } from "@/components/sorteo/MonedaSorteo";
import RaspaFoil, {
  type FoilRevelado,
  type RaspaFoilApi,
} from "@/components/sorteo/RaspaFoil";
import { COLORES_CONFETTI } from "@/components/sorteo/ResultadoGanador";

/** Coreografía del reveal (ms desde que se cruza el umbral). */
const T_GANADOR = {
  vibracion: 120,
  confetti1: 150,
  brillo: 200,
  anuncio: 450,
  confetti2: 550,
  fin: 1400,
} as const;
const T_SIGUE = { vibracion: 100, anuncio: 600, fin: 1600 } as const;
/** Con movimiento reducido el foil sale de golpe y el hold se acorta. */
const T_CORTE = 600;

/** Duración del raspado automático (lo que pidió el cliente: 2-3 s con el reveal). */
const AUTO_MS = 1800;

/**
 * Camino de la moneda en el raspado automático, en coordenadas normalizadas
 * 0..1 de la ventana. Arranca donde descansa la moneda (el badge del centro) y
 * barre en serpentina: cubre el umbral del 55 % alrededor del cuarto pase, o
 * sea el reveal cae ~1,4 s después del click.
 */
const CAMINO_AUTO: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.5],
  [0.09, 0.16],
  [0.91, 0.16],
  [0.91, 0.33],
  [0.09, 0.33],
  [0.09, 0.5],
  [0.91, 0.5],
  [0.91, 0.67],
  [0.09, 0.67],
  [0.09, 0.84],
  [0.91, 0.84],
];

/** Umbrales del helper "seguí raspando": ni recién empezado ni casi listo. */
const AYUDA_MIN = 0.1;
const AYUDA_MAX = 0.45;
const AYUDA_ESPERA_MS = 1500;

type Props = {
  ganador: boolean;
  /** Descripción del premio: solo se usa en el compacto del ganador. */
  premio: string;
  /** El reveal terminó: el orquestador pasa a la pantalla de resultado completa. */
  onFin: () => void;
};

/** Suaviza el arranque y el final del barrido automático (smoothstep). */
function suavizar(t: number): number {
  return t * t * (3 - 2 * t);
}

export default function PantallaRaspa({ ganador, premio, onFin }: Props) {
  const reducir = useReducedMotion() ?? false;
  const controlesCompacto = useAnimationControls();

  const [revelado, setRevelado] = useState<FoilRevelado>(null);
  const [monedaVisible, setMonedaVisible] = useState(true);
  const [monedaAuto, setMonedaAuto] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [brillo, setBrillo] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const [canvasRoto, setCanvasRoto] = useState(false);

  const ventanaRef = useRef<HTMLDivElement>(null);
  const monedaRef = useRef<HTMLDivElement>(null);
  const foilRef = useRef<RaspaFoilApi | null>(null);

  const reveladoRef = useRef(false);
  const autoRef = useRef(false);
  const rafRef = useRef(0);
  const progresoRef = useRef(0);
  const ayudaRef = useRef(false);
  const relojAyudaRef = useRef(0);
  const relojesRef = useRef<number[]>([]);
  // onFin llega como arrow inline del orquestador: se lee por ref para que los
  // timers de la coreografía no dependan de su identidad.
  const onFinRef = useRef(onFin);
  useEffect(() => {
    onFinRef.current = onFin;
  });

  // Un solo lugar donde se limpia todo lo pendiente al desmontar.
  useEffect(() => {
    const relojes = relojesRef.current;
    return () => {
      for (const id of relojes) window.clearTimeout(id);
      window.clearTimeout(relojAyudaRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const programar = useCallback((fn: () => void, ms: number) => {
    relojesRef.current.push(window.setTimeout(fn, ms));
  }, []);

  const vibrar = useCallback(
    (patron: number | number[]) => {
      if (reducir) return;
      try {
        navigator.vibrate?.(patron);
      } catch {
        /* algunos WebViews tiran si el gesto no viene del usuario */
      }
    },
    [reducir],
  );

  const rafaga = useCallback((opts: confetti.Options) => {
    void confetti({
      origin: { y: 0.35 },
      colors: COLORES_CONFETTI,
      disableForReducedMotion: true,
      zIndex: 60,
      ...opts,
    });
  }, []);

  const ocultarAyuda = useCallback(() => {
    window.clearTimeout(relojAyudaRef.current);
    if (ayudaRef.current) {
      ayudaRef.current = false;
      setAyuda(false);
    }
  }, []);

  // ---- El reveal: idempotente (umbral, botón y canvas roto compiten) ----
  const revelar = useCallback(() => {
    if (reveladoRef.current) return;
    reveladoRef.current = true;
    autoRef.current = false;
    cancelAnimationFrame(rafRef.current);
    ocultarAyuda();
    setMonedaVisible(false);

    const dicho = ganador
      ? `Ganaste. ${premio}.`
      : "Esta vez no fue. Tu participación quedó registrada.";

    if (reducir) {
      // Corte seco: sin fade, sin confetti, sin haptics. Hold corto.
      setRevelado("corte");
      setAnuncio(dicho);
      programar(() => onFinRef.current(), T_CORTE);
      return;
    }

    if (ganador) {
      setRevelado("ganador");
      // Mismas físicas que el trofeo de ResultadoGanador: el pop de acá y el
      // spring de allá se leen como un solo gesto continuo.
      void controlesCompacto
        .start({ scale: 1.04, transition: { duration: 0.12, ease: [0.25, 1, 0.5, 1] } })
        .then(() =>
          controlesCompacto.start({
            scale: 1,
            transition: { type: "spring", stiffness: 260, damping: 18 },
          }),
        );
      programar(() => vibrar([12, 60, 12]), T_GANADOR.vibracion);
      programar(
        () => rafaga({ particleCount: 120, spread: 75, startVelocity: 42 }),
        T_GANADOR.confetti1,
      );
      programar(() => setBrillo(true), T_GANADOR.brillo);
      programar(() => setAnuncio(dicho), T_GANADOR.anuncio);
      programar(
        () => rafaga({ particleCount: 90, spread: 110, startVelocity: 35 }),
        T_GANADOR.confetti2,
      );
      programar(() => onFinRef.current(), T_GANADOR.fin);
      return;
    }

    // No ganador: apenas más lento, sin teatro. La verdad y nada más.
    setRevelado("sigue");
    programar(() => vibrar(10), T_SIGUE.vibracion);
    programar(() => setAnuncio(dicho), T_SIGUE.anuncio);
    programar(() => onFinRef.current(), T_SIGUE.fin);
  }, [
    controlesCompacto,
    ganador,
    ocultarAyuda,
    premio,
    programar,
    rafaga,
    reducir,
    vibrar,
  ]);

  // ---- Raspado automático: la moneda hace el gesto sola ----
  const rasparSolo = useCallback(() => {
    if (reveladoRef.current || autoRef.current) return;
    const ventana = ventanaRef.current;
    // Con movimiento reducido (o sin canvas) el botón revela directo: el
    // barrido animado es exactamente lo que el usuario pidió no ver.
    if (reducir || canvasRoto || !foilRef.current || !ventana) {
      revelar();
      return;
    }
    const { width: w, height: h } = ventana.getBoundingClientRect();
    if (w < 1 || h < 1) {
      revelar();
      return;
    }

    autoRef.current = true;
    setMonedaAuto(true);
    ocultarAyuda();

    // Largos de cada tramo en px reales: velocidad constante de la mano.
    const largos: number[] = [];
    let total = 0;
    for (let i = 1; i < CAMINO_AUTO.length; i++) {
      const a = CAMINO_AUTO[i - 1];
      const b = CAMINO_AUTO[i];
      const l = Math.hypot((b[0] - a[0]) * w, (b[1] - a[1]) * h);
      largos.push(l);
      total += l;
    }

    const puntoEn = (dist: number): readonly [number, number] => {
      let resto = dist;
      for (let i = 0; i < largos.length; i++) {
        if (resto <= largos[i] || i === largos.length - 1) {
          const a = CAMINO_AUTO[i];
          const b = CAMINO_AUTO[i + 1];
          const f = largos[i] > 0 ? Math.min(1, resto / largos[i]) : 1;
          return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        }
        resto -= largos[i];
      }
      return CAMINO_AUTO[CAMINO_AUTO.length - 1];
    };

    const inicio = performance.now();
    const paso = (ahora: number) => {
      if (reveladoRef.current || !autoRef.current) return;
      const t = Math.min(1, (ahora - inicio) / AUTO_MS);
      const [nx, ny] = puntoEn(suavizar(t) * total);
      foilRef.current?.raspar(nx, ny, t > 0);
      // El propio raspado puede haber cruzado el umbral: ahí manda el reveal.
      if (reveladoRef.current) return;
      const moneda = monedaRef.current;
      if (moneda) {
        moneda.style.transform = `translate(${(nx - 0.5) * w}px, ${
          (ny - 0.5) * h
        }px) rotate(-8deg)`;
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(paso);
      } else {
        // Red de seguridad: si el barrido no llegó al umbral (ventana rara),
        // el reveal ocurre igual al terminar el camino.
        revelar();
      }
    };
    rafRef.current = requestAnimationFrame(paso);
  }, [canvasRoto, ocultarAyuda, reducir, revelar]);

  // ---- Avisos del foil ----
  const alPrimerTrazo = useCallback(() => {
    setMonedaVisible(false);
    vibrar(8);
  }, [vibrar]);

  const alProgreso = useCallback(
    (pct: number) => {
      progresoRef.current = pct;
      if (autoRef.current) return;
      if (ayudaRef.current) {
        ayudaRef.current = false;
        setAyuda(false);
      }
      window.clearTimeout(relojAyudaRef.current);
      relojAyudaRef.current = window.setTimeout(() => {
        const p = progresoRef.current;
        if (reveladoRef.current || p < AYUDA_MIN || p > AYUDA_MAX) return;
        ayudaRef.current = true;
        setAyuda(true);
      }, AYUDA_ESPERA_MS);
    },
    [],
  );

  const alCanvasRoto = useCallback(() => {
    setCanvasRoto(true);
    revelar();
  }, [revelar]);

  const instruccion = canvasRoto
    ? "Tu navegador no deja raspar: te mostramos el resultado igual."
    : "Raspá el cartón con el dedo y enterate al toque si ganaste.";

  return (
    <div className="px-6 pb-7 pt-8 text-center sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground">
        Sorteo RioGas
      </p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-card-foreground">
        ¡A raspar!
      </h1>
      {/* Al revelar, la instrucción se apaga (conservando su alto: nada salta):
          "raspá el cartón" contradiría al resultado que ya está en pantalla. */}
      <p
        className={`mx-auto mt-2 max-w-[34ch] text-pretty text-sm leading-relaxed text-muted-foreground transition-opacity duration-[250ms] ${
          revelado === null ? "opacity-100" : "opacity-0"
        }`}
      >
        {instruccion}
      </p>

      {/* Ventana troquelada: el mismo ticket punteado del código de canje, para
          que el reveal se lea como "el premio estaba tapado". */}
      <div className="mt-5 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/[0.04] p-1.5">
        <div
          ref={ventanaRef}
          className="raspa-ventana relative h-[220px] select-none overflow-hidden rounded-[10px]"
        >
          {/* Decorativo: el resultado se anuncia por el role=status de abajo. */}
          <div aria-hidden className="absolute inset-0">
            {ganador ? (
              <motion.div
                animate={controlesCompacto}
                className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-card px-5 text-center"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,122,26,0.14),transparent_70%)]" />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
                  <Trophy
                    className="h-[22px] w-[22px] text-accent"
                    strokeWidth={1.75}
                  />
                </div>
                <p className="relative mt-3 text-[2.25rem] font-extrabold leading-none tracking-tight text-primary">
                  ¡GANASTE!
                </p>
                <p className="relative mt-2.5 line-clamp-2 max-w-[30ch] text-balance text-sm font-semibold leading-snug text-accent">
                  {premio}
                </p>
              </motion.div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-card px-5 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                  <Flame
                    className="h-[22px] w-[22px] text-primary/60"
                    strokeWidth={1.75}
                  />
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-card-foreground">
                  Esta vez no fue…
                </p>
                <p className="mt-2.5 text-sm leading-snug text-muted-foreground">
                  Tu participación quedó registrada
                </p>
              </div>
            )}
          </div>

          <RaspaFoil
            revelado={revelado}
            apiRef={foilRef}
            onPrimerTrazo={alPrimerTrazo}
            onProgreso={alProgreso}
            onUmbral={revelar}
            onCanvasRoto={alCanvasRoto}
          />

          {/* Barrido de brillo sobre lo recién revelado (solo ganador). */}
          {brillo && <div aria-hidden className="raspa-brillo" />}

          {/* La moneda descansa en el badge del foil: enseña el gesto y, con el
              botón, lo hace sola. Con movimiento reducido se queda quieta —
              sigue siendo la affordance, deja de ser una animación. */}
          {!canvasRoto && (
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div
                ref={monedaRef}
                className={[
                  "raspa-moneda",
                  monedaAuto || reducir ? "" : "raspa-moneda--demo",
                  monedaVisible ? "" : "raspa-moneda--oculta",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MonedaSVG size={32} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alto fijo: el helper aparece y desaparece sin mover el botón. */}
      <div className="mt-2.5 h-4">
        <p
          aria-hidden
          className={`text-xs text-muted-foreground transition-opacity duration-[250ms] ${
            ayuda ? "opacity-100" : "opacity-0"
          }`}
        >
          Vas bien, seguí raspando…
        </p>
      </div>

      <button
        type="button"
        onClick={rasparSolo}
        disabled={revelado !== null}
        className="mx-auto mt-2 inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
      >
        Ver el resultado sin raspar
      </button>

      <p role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </div>
  );
}
