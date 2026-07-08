"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/EmptyState";
import { estadoLabel, estadoVariant } from "@/lib/types/cliente";
import type { Persona360 as Persona360Data } from "@/lib/types/persona";
import { RegistrosVinculados } from "./RegistrosVinculados";
import { CanonicalEditor } from "./CanonicalEditor";
import { Home, MapPin, Phone, Star } from "lucide-react";

interface Persona360Props {
  data: Persona360Data;
}

export function Persona360({ data }: Persona360Props) {
  const { persona, registros, telefonos, direcciones, hogares } = data;

  const nombre = persona.nombreOficial ?? registros[0]?.nombre ?? "Persona sin nombre";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-foreground">{nombre}</h1>
          <span className="text-xs text-muted-foreground font-mono">#{persona.id}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={estadoVariant(persona.estado)}>{estadoLabel(persona.estado)}</Badge>
          {persona.cedula && <Badge variant="outline">Cédula: {persona.cedula}</Badge>}
          {persona.rucPrincipal && <Badge variant="outline">RUC: {persona.rucPrincipal}</Badge>}
        </div>
      </header>

      <RegistrosVinculados personaId={persona.id} registros={registros} />

      {/* ── Teléfonos agregados ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Teléfonos ({telefonos.length})
        </h2>
        {telefonos.length === 0 ? (
          <EmptyState icon={Phone} size="sm" title="Sin teléfonos registrados" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Alias</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Principal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {telefonos.map((tel) => (
                <TableRow key={tel.id}>
                  <TableCell className="font-mono">{tel.numero}</TableCell>
                  <TableCell>{tel.tipo ?? "—"}</TableCell>
                  <TableCell>{tel.alias ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={estadoVariant(tel.estado)}>{estadoLabel(tel.estado)}</Badge>
                  </TableCell>
                  <TableCell>
                    {tel.principal && (
                      <Star
                        role="img"
                        aria-label="Principal"
                        className="size-3.5 text-amber-500 fill-amber-500"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ── Direcciones agregadas ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Direcciones ({direcciones.length})
        </h2>
        {direcciones.length === 0 ? (
          <EmptyState icon={MapPin} size="sm" title="Sin direcciones registradas" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dirección</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Principal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {direcciones.map((dir) => (
                <TableRow key={dir.id}>
                  <TableCell className="truncate max-w-[420px]">
                    {dir.direccion ?? ([dir.calle, dir.nro].filter(Boolean).join(" ") || "—")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={estadoVariant(dir.estado)}>{estadoLabel(dir.estado)}</Badge>
                  </TableCell>
                  <TableCell>
                    {dir.principal && (
                      <Star
                        role="img"
                        aria-label="Principal"
                        className="size-3.5 text-amber-500 fill-amber-500"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ── Hogares ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Hogares ({hogares.length})
        </h2>
        {hogares.length === 0 ? (
          <EmptyState icon={Home} size="sm" title="Sin hogar" />
        ) : (
          <div className="space-y-2">
            {hogares.map((hogar) => (
              <div
                key={hogar.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {hogar.etiqueta ?? `Hogar #${hogar.id}`}
                  </p>
                  {hogar.direccionTextoNorm && (
                    <p className="text-xs text-muted-foreground truncate">
                      {hogar.direccionTextoNorm}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <CanonicalEditor persona={persona} telefonos={telefonos} direcciones={direcciones} />
    </div>
  );
}
