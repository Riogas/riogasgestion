"use client";

// Pantalla de "no ganaste": la llama naranja late suave (framer-motion,
// quieta si prefers-reduced-motion), agradecimiento cálido con el nombre de
// pila. Sin botón de reintento: el código ya se consumió.
import { motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";

type Props = {
  /** Nombre completo tal como lo ingresó: acá se usa solo el de pila. */
  nombre: string;
};

function nombreDePila(nombre: string): string {
  const pila = nombre.trim().split(/\s+/)[0] ?? "";
  if (!pila) return "";
  return pila.charAt(0).toUpperCase() + pila.slice(1);
}

export default function ResultadoSigue({ nombre }: Props) {
  const reducirMovimiento = useReducedMotion();
  const pila = nombreDePila(nombre);
  const latido = { duration: 2.2, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <div className="flex flex-col items-center px-6 py-11 text-center sm:px-8">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full bg-accent/15"
          animate={
            reducirMovimiento
              ? undefined
              : { scale: [1, 1.22, 1], opacity: [0.65, 0.3, 0.65] }
          }
          transition={latido}
        />
        <motion.div
          className="relative flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-accent/15"
          animate={reducirMovimiento ? undefined : { scale: [1, 1.06, 1] }}
          transition={latido}
        >
          <Flame className="h-9 w-9 text-accent" strokeWidth={1.75} aria-hidden />
        </motion.div>
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-card-foreground">
        {pila ? `Esta vez no fue, ${pila}…` : "Esta vez no fue…"}
      </h1>

      <p className="mt-3 max-w-[36ch] text-base leading-relaxed text-muted-foreground">
        Tu participación quedó registrada. Gracias por ser parte de la familia
        RioGas: que no se apague la llama, pronto vienen más chances de ganar.
      </p>
    </div>
  );
}
