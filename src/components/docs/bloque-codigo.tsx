"use client";

// Bloque de código con botón "Copiar". Lo usa todo el portal: ejemplos, cuerpos
// de request, respuestas y el resultado del "probar".
//
// El copiado tiene fallback a `document.execCommand` a propósito: la Clipboard
// API sólo existe en contextos seguros, y a Goya se le entra por http en más de
// una máquina de la empresa. Un botón que no hace nada es peor que no tenerlo.
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  codigo: string;
  /** Se muestra arriba a la izquierda: "curl", "fetch (JS)", "respuesta"… */
  etiqueta?: string;
  className?: string;
  /** Alto máximo antes de scrollear (default: sin tope). */
  alturaMaxima?: string;
}

export function BloqueCodigo({ codigo, etiqueta, className, alturaMaxima }: Props) {
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  const copiar = useCallback(async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigo);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      const area = document.createElement("textarea");
      area.value = codigo;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(area);
    }
    if (ok) {
      setCopiado(true);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setCopiado(false), 1800);
    }
  }, [codigo]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[var(--radius-md)] border border-border bg-muted/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/60 px-3 py-1.5">
        <span className="truncate font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {etiqueta ?? "código"}
        </span>
        <button
          type="button"
          onClick={copiar}
          aria-label={`Copiar ${etiqueta ?? "código"}`}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1",
            "text-[11px] font-medium transition-colors duration-150",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring",
            copiado
              ? "bg-success/15 text-success"
              : "text-muted-foreground hover:bg-background hover:text-foreground",
          )}
        >
          {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre
        className="overflow-x-auto px-3 py-2.5 text-[12.5px] leading-relaxed"
        style={alturaMaxima ? { maxHeight: alturaMaxima, overflowY: "auto" } : undefined}
      >
        <code className="font-mono text-foreground">{codigo}</code>
      </pre>
    </div>
  );
}
