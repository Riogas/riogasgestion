"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type Cliente } from "@/lib/types/cliente";
import {
  Phone,
  MessageCircle,
  MapPin,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mini read-only map (no SSR)
const DynamicMapa = dynamic(
  () => import("@/components/mapa/OpenStreetMap").then((m) => ({ default: m.default })),
  { ssr: false, loading: () => <div className="h-36 rounded-lg bg-muted/50 animate-pulse" /> }
);

interface ClienteResumenProps {
  cliente: Cliente;
}

export function ClienteResumen({ cliente }: ClienteResumenProps) {
  const [collapsed, setCollapsed] = useState(false);

  const telPrincipal =
    cliente.telefonos.find((t) => t.esPrincipal) ?? cliente.telefonos[0];
  const dirPrincipal =
    cliente.direcciones.find((d) => d.esPrincipal) ?? cliente.direcciones[0];

  const telNumero = telPrincipal?.numero ?? null;
  // Build WhatsApp number: strip non-digits, assume UY country code if no +
  const telWa = telNumero
    ? telNumero.replace(/\D/g, "").replace(/^0/, "598")
    : null;

  const fechaAlta = cliente.fechaAlta
    ? new Date(cliente.fechaAlta).toLocaleDateString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-10" : "w-64 min-w-[16rem]"
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3.5 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted transition-colors"
        aria-label={collapsed ? "Expandir panel lateral" : "Colapsar panel lateral"}
      >
        {collapsed ? (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronLeft className="size-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Content — hidden when collapsed */}
      <div
        className={cn(
          "flex flex-col gap-5 p-4 overflow-hidden transition-opacity duration-200",
          collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        {/* ── Contacto rápido ── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Contacto rápido
          </h3>
          {telNumero ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="size-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono text-sm truncate">{telNumero}</span>
                {telPrincipal?.alias && (
                  <Badge variant="outline" className="text-[10px] py-0">
                    {telPrincipal.alias}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <a
                  href={`tel:${telNumero.replace(/\s/g, "")}`}
                  className="flex-1"
                  aria-label={`Llamar a ${telNumero}`}
                >
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                    <Phone className="size-3.5" />
                    Llamar
                  </Button>
                </a>
                {telWa && (
                  <a
                    href={`https://wa.me/${telWa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                    aria-label={`WhatsApp a ${telNumero}`}
                  >
                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                      <MessageCircle className="size-3.5" />
                      WhatsApp
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin teléfono registrado</p>
          )}
        </section>

        {/* ── Mini mapa ── */}
        {dirPrincipal?.lat != null && dirPrincipal?.lng != null && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <MapPin className="size-3.5" />
              Dirección principal
            </h3>
            <p className="text-xs text-muted-foreground mb-2 truncate">
              {[
                dirPrincipal.calle,
                dirPrincipal.nroPuerta,
                dirPrincipal.esquina1 ? `esq. ${dirPrincipal.esquina1}` : null,
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
            <div className="rounded-lg overflow-hidden border border-border">
              <DynamicMapa
                departamento={undefined}
                localidad={undefined}
                direccion={dirPrincipal.calle ?? ""}
                nroPuerta={dirPrincipal.nroPuerta ?? ""}
                esquina1={dirPrincipal.esquina1 ?? ""}
                esquina2={dirPrincipal.esquina2 ?? ""}
                zonas={[]}
                mapHeightPx={140}
              />
            </div>
          </section>
        )}

        {/* ── Dato maestro ── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Dato maestro
          </h3>
          <dl className="space-y-1.5 text-xs">
            {cliente.rutCi && (
              <DataRow icon={<User className="size-3.5" />} label="RUT/CI" value={cliente.rutCi} />
            )}
            {cliente.gci && (
              <DataRow icon={<Hash className="size-3.5" />} label="GCI" value={cliente.gci} />
            )}
            <DataRow
              icon={<Calendar className="size-3.5" />}
              label="Alta"
              value={fechaAlta}
            />
          </dl>
        </section>
      </div>
    </aside>
  );
}

function DataRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        <span className="text-foreground font-medium">{value}</span>
      </div>
    </div>
  );
}
