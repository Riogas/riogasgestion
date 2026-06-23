"use client";

import { useState } from "react";

type Props = { code: string; ruta: string; nombre: string };
type Estado = "idle" | "form" | "loading" | "ok" | "error";

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
      } else {
        setEstado("error");
        setMsg(
          d?.data?.message ||
            d?.data?.Mensaje ||
            d?.error ||
            `No se pudo enviar (estado ${d?.status ?? r.status}).`,
        );
      }
    } catch {
      setEstado("error");
      setMsg("No se pudo enviar la solicitud.");
    }
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
