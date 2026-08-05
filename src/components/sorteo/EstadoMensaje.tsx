"use client";

// Pantalla genérica de mensaje para los estados terminales del sorteo público
// (sin_cookie / usado / no_iniciado / finalizado / invalido / error_temporal /
// limite_dispositivo / edad_invalida). Ícono lucide en círculo tonal, título
// y mensaje cálidos en rioplatense, acción opcional (ej: reintentar).
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type TonoMensaje = "info" | "alerta" | "calido";

const TONOS: Record<TonoMensaje, { circulo: string; icono: string }> = {
  info: { circulo: "bg-primary/10", icono: "text-primary" },
  alerta: { circulo: "bg-destructive/10", icono: "text-destructive" },
  calido: { circulo: "bg-accent/15", icono: "text-accent" },
};

type Props = {
  icono: LucideIcon;
  titulo: string;
  mensaje: string;
  tono?: TonoMensaje;
  accion?: ReactNode;
};

export default function EstadoMensaje({
  icono: Icono,
  titulo,
  mensaje,
  tono = "info",
  accion,
}: Props) {
  const estilos = TONOS[tono];

  return (
    <div className="flex flex-col items-center px-6 py-10 text-center sm:px-8">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full ${estilos.circulo}`}
      >
        <Icono
          className={`h-9 w-9 ${estilos.icono}`}
          strokeWidth={1.75}
          aria-hidden
        />
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-card-foreground">
        {titulo}
      </h1>

      <p className="mt-3 max-w-[34ch] text-base leading-relaxed text-muted-foreground">
        {mensaje}
      </p>

      {accion ? <div className="mt-7 w-full">{accion}</div> : null}
    </div>
  );
}
