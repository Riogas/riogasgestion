"use client";

// Pantalla de GANADOR: héroe con gradiente azul→naranja, confetti de marca
// (doble ráfaga, skip total con prefers-reduced-motion) y el código de canje
// gigante estilo ticket con botón copiar (Clipboard API + fallback execCommand
// + selección manual para WebViews viejos de lectores QR).
import confetti from "canvas-confetti";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, PhoneCall, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SorteoPublico } from "@/lib/sorteo/publicApi";

const COLORES_CONFETTI = ["#1E5BB8", "#FF7A1A", "#10B981", "#FFFFFF"];

/** 099123456 → "099 123 456" · 24001234 → "2400 1234" (solo para mostrar). */
function formatearTelefono(telefono: string): string {
  if (/^09\d{7}$/.test(telefono)) {
    return `${telefono.slice(0, 3)} ${telefono.slice(3, 6)} ${telefono.slice(6)}`;
  }
  if (/^[24]\d{7}$/.test(telefono)) {
    return `${telefono.slice(0, 4)} ${telefono.slice(4)}`;
  }
  return telefono;
}

type Props = {
  codigoCanje: string;
  /** Teléfono ya normalizado que ingresó el participante. */
  telefono: string;
  sorteo: SorteoPublico;
};

export default function ResultadoGanador({ codigoCanje, telefono, sorteo }: Props) {
  const reducirMovimiento = useReducedMotion();
  const [copiado, setCopiado] = useState(false);
  const [copiaManual, setCopiaManual] = useState(false);
  const codigoRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confetti: ráfaga inicial + segunda a los 400ms. Nada si el usuario pidió
  // menos movimiento (chequeo propio + disableForReducedMotion de la lib).
  useEffect(() => {
    if (reducirMovimiento) return;
    const rafaga = (opts: confetti.Options) =>
      confetti({
        origin: { y: 0.35 },
        colors: COLORES_CONFETTI,
        disableForReducedMotion: true,
        zIndex: 60,
        ...opts,
      });
    void rafaga({ particleCount: 120, spread: 75, startVelocity: 42 });
    const segunda = setTimeout(
      () => void rafaga({ particleCount: 90, spread: 110, startVelocity: 35 }),
      400,
    );
    return () => clearTimeout(segunda);
  }, [reducirMovimiento]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const marcarCopiado = useCallback(() => {
    setCopiado(true);
    setCopiaManual(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiado(false), 2500);
  }, []);

  const copiar = useCallback(async () => {
    // 1) Clipboard API (requiere secure context)
    try {
      await navigator.clipboard.writeText(codigoCanje);
      marcarCopiado();
      return;
    } catch {
      /* sigue el fallback */
    }
    // 2) execCommand sobre un textarea invisible (WebViews viejos)
    try {
      const area = document.createElement("textarea");
      area.value = codigoCanje;
      area.setAttribute("readonly", "");
      area.style.position = "absolute";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      if (ok) {
        marcarCopiado();
        return;
      }
    } catch {
      /* sigue el último recurso */
    }
    // 3) Último recurso: seleccionar el código y pedir copia manual
    try {
      if (codigoRef.current) {
        const rango = document.createRange();
        rango.selectNodeContents(codigoRef.current);
        const seleccion = window.getSelection();
        seleccion?.removeAllRanges();
        seleccion?.addRange(rango);
      }
    } catch {
      /* sin selección posible */
    }
    setCopiaManual(true);
  }, [codigoCanje, marcarCopiado]);

  // "ABCD2345MNPQ" → "ABCD 2345 MNPQ": legible sin romper el copiado (el
  // botón siempre copia el código crudo).
  const codigoAgrupado = codigoCanje.replace(/(.{4})/g, "$1 ").trim();

  return (
    <div>
      {/* Héroe gradiente azul → naranja */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#123C78] via-[#1E5BB8] to-[#FF7A1A] px-6 pb-9 pt-9 text-center text-white sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-white/15 blur-3xl"
        />
        <motion.div
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur"
        >
          <Trophy className="h-8 w-8" strokeWidth={1.75} aria-hidden />
        </motion.div>

        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.4em] text-white/85">
          Sorteo RioGas
        </p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15, ease: [0.25, 1, 0.5, 1] }}
          className="mt-1 text-5xl font-extrabold tracking-tight drop-shadow-sm"
        >
          ¡GANASTE!
        </motion.h1>
        <p className="mx-auto mt-3 max-w-[30ch] text-base font-medium leading-relaxed text-white/95">
          {sorteo.premioDescripcion}
        </p>
      </div>

      {/* Ticket con el código de canje */}
      <div className="px-6 py-7 sm:px-8">
        <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/[0.04] px-4 py-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Tu código de canje
          </p>
          <p className="mt-3 break-words font-mono text-[1.7rem] font-bold leading-tight tracking-[0.14em] text-primary">
            <span ref={codigoRef}>{codigoAgrupado}</span>
          </p>
          <Button
            type="button"
            onClick={() => void copiar()}
            variant="outline"
            className="mt-4 h-12 w-full rounded-xl text-base font-semibold"
          >
            {copiado ? (
              <>
                <Check className="size-5 text-success" aria-hidden />
                Copiado
              </>
            ) : (
              <>
                <Copy className="size-5" aria-hidden />
                Copiar código
              </>
            )}
          </Button>
          <p aria-live="polite" className="sr-only">
            {copiado ? "Código copiado" : ""}
          </p>
          {copiaManual && !copiado && (
            <p className="mt-2 text-xs text-muted-foreground">
              No pudimos copiarlo solos: mantené apretado el código y copialo.
            </p>
          )}
        </div>

        <p className="mt-5 flex items-start gap-2.5 rounded-xl bg-muted p-3.5 text-sm leading-relaxed text-foreground">
          <PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span>
            Guardá este código. RioGas te va a contactar al{" "}
            <strong className="whitespace-nowrap">
              {formatearTelefono(telefono)}
            </strong>{" "}
            para coordinar la entrega.
          </span>
        </p>
      </div>
    </div>
  );
}
