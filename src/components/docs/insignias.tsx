// Insignias del portal: método HTTP y categoría de autenticación.
//
// Los colores salen de los tokens del tema (--primary, --success, --warn,
// --destructive, --chart-*), así que funcionan igual en claro y en oscuro. Sin
// emojis: los íconos son SVG de lucide, como en el resto de la app.
import { AlertTriangle, ArrowRightLeft, Globe, KeyRound, ShieldCheck, Ticket, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETIQUETA_CATEGORIA, type CategoriaAuth } from "@/lib/docs/vista";

const COLOR_METODO: Record<string, string> = {
  GET: "bg-primary/12 text-primary",
  POST: "bg-success/15 text-success",
  PUT: "bg-warn/15 text-warn",
  PATCH: "bg-warn/15 text-warn",
  DELETE: "bg-destructive/12 text-destructive",
  HEAD: "bg-muted text-muted-foreground",
};

export function InsigniaMetodo({ metodo, className }: { metodo: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
        "px-1.5 py-0.5 font-mono text-[10.5px] font-bold leading-4 tracking-wide",
        COLOR_METODO[metodo] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {metodo}
    </span>
  );
}

/** Estilo + ícono por categoría. `ninguna` y `publica` gritan a propósito. */
const ESTILO_AUTH: Record<CategoriaAuth, { clases: string; Icono: typeof ShieldCheck }> = {
  ninguna: {
    clases: "bg-destructive/12 text-destructive ring-1 ring-inset ring-destructive/30",
    Icono: AlertTriangle,
  },
  publica: { clases: "bg-warn/15 text-warn ring-1 ring-inset ring-warn/30", Icono: Globe },
  delegada: { clases: "bg-warn/10 text-warn/90 ring-1 ring-inset ring-warn/20", Icono: ArrowRightLeft },
  sesion: { clases: "bg-chart-4/15 text-chart-4", Icono: Ticket },
  "api-key": { clases: "bg-chart-5/15 text-chart-5", Icono: KeyRound },
  jwt: { clases: "bg-muted text-muted-foreground", Icono: UserCheck },
  root: { clases: "bg-success/15 text-success", Icono: ShieldCheck },
  otra: { clases: "bg-muted text-muted-foreground", Icono: UserCheck },
};

export function InsigniaAuth({
  categoria,
  compacta = false,
  className,
}: {
  categoria: CategoriaAuth;
  compacta?: boolean;
  className?: string;
}) {
  const { clases, Icono } = ESTILO_AUTH[categoria] ?? ESTILO_AUTH.otra;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-medium",
        compacta ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        clases,
        className,
      )}
      title={`Autenticación: ${ETIQUETA_CATEGORIA[categoria]}`}
    >
      <Icono className={compacta ? "size-2.5" : "size-3"} aria-hidden />
      {ETIQUETA_CATEGORIA[categoria]}
    </span>
  );
}

/** Pastilla de status HTTP para el resultado del "probar". */
export function InsigniaStatus({ status, texto }: { status: number; texto?: string }) {
  const clases =
    status >= 500
      ? "bg-destructive/12 text-destructive"
      : status >= 400
        ? "bg-warn/15 text-warn"
        : status >= 300
          ? "bg-chart-4/15 text-chart-4"
          : "bg-success/15 text-success";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", clases)}>
      {status}
      {texto ? <span className="font-normal opacity-80">{texto}</span> : null}
    </span>
  );
}
