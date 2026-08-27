"use client";

import { useState } from "react";
import { RUTA_LOGIN_SESION_EXPIRADA } from "@/lib/sesion";

type Props = { code: string; ruta: string; nombre: string };
// "sesion-vencida", "usuario-inactivo" y "no-configurado" son callejones sin
// salida distintos del error genérico: no se arreglan reintentando el envío, así
// que tienen su propia pantalla en vez del formulario con un mensaje en rojo.
type Estado =
  | "idle"
  | "form"
  | "loading"
  | "ok"
  | "error"
  | "sesion-vencida"
  | "usuario-inactivo"
  | "no-configurado";

export default function SolicitarAccesoButton({ code, ruta, nombre }: Props) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState("");

  async function enviar() {
    setEstado("loading");
    try {
      const r = await fetch("/api/solicitar-acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ruta, nombre, motivo }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) {
        setEstado("ok");
        setMsg("Solicitud enviada. Te avisaremos cuando se apruebe.");
        return;
      }

      // El usuario no está activo en SecuritySuite: no es la sesión, y ofrecerle
      // "volver a entrar" lo manda a un loop (el login lo deja pasar igual).
      if (d?.motivo === "USUARIO_NO_ACTIVO") {
        setEstado("usuario-inactivo");
        return;
      }

      // La solicitud va firmada con el mismo token que trajo al usuario acá: si
      // secapi lo rechaza, reintentar no sirve de nada.
      if (d?.motivo === "SESION_VENCIDA" || r.status === 401) {
        setEstado("sesion-vencida");
        return;
      }
      if (d?.motivo === "SECAPI_NO_CONFIGURADO") {
        setEstado("no-configurado");
        return;
      }

      setEstado("error");
      setMsg(
        d?.data?.message ||
          d?.data?.Mensaje ||
          d?.error ||
          `No se pudo enviar (estado ${d?.status ?? r.status}).`,
      );
    } catch {
      setEstado("error");
      setMsg("No se pudo enviar la solicitud.");
    }
  }

  if (estado === "sesion-vencida") {
    return (
      <div className="flex-1 flex flex-col gap-2 text-center">
        <p className="text-xs text-muted-foreground">
          Tu sesión venció, por eso no se pudo enviar la solicitud.
        </p>
        <a
          href={RUTA_LOGIN_SESION_EXPIRADA}
          className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition text-sm"
        >
          Volver a entrar
        </a>
      </div>
    );
  }

  if (estado === "usuario-inactivo") {
    return (
      <div className="flex-1 px-5 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-center text-xs">
        Tu usuario no está activo en SecuritySuite, así que no se puede tramitar
        el permiso. Avisá a Sistemas con el código{" "}
        <code className="rounded bg-background border border-border px-1 py-0.5">
          USUARIO_NO_ENCONTRADO
        </code>
        .
      </div>
    );
  }

  if (estado === "no-configurado") {
    return (
      <div className="flex-1 px-5 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-center text-xs">
        El servicio de seguridad no está configurado. No es tu sesión ni tus
        permisos: avisá a Sistemas.
      </div>
    );
  }

  if (estado === "ok") {
    return (
      <div className="flex-1 px-5 py-2 rounded-lg bg-green-600/15 text-green-700 border border-green-600/30 font-medium text-center text-sm">
        ✓ {msg}
      </div>
    );
  }

  if (estado === "idle") {
    return (
      <button
        type="button"
        onClick={() => setEstado("form")}
        className="flex-1 px-5 py-2 rounded-lg bg-muted text-foreground border border-border font-semibold hover:bg-muted/70 transition text-center"
      >
        Solicitar acceso
      </button>
    );
  }

  // form / loading / error
  return (
    <div className="flex-1 flex flex-col gap-2">
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo (opcional): por qué necesitás acceso…"
        rows={2}
        disabled={estado === "loading"}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {estado === "error" && (
        <p className="text-xs text-red-600">{msg}</p>
      )}
      <button
        type="button"
        onClick={enviar}
        disabled={estado === "loading"}
        className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition text-center disabled:opacity-60 text-sm"
      >
        {estado === "loading" ? "Enviando…" : "Enviar solicitud"}
      </button>
    </div>
  );
}
