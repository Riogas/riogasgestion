"use client";

import { Brush, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  Puesto,
  ServiceType,
  ZoneType,
} from "@/lib/types/zona";

// Select nativo con estética dark — mismo patrón que FilterSelect de Moviles.
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-[150px]">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ZoneFiltersProps {
  puestos: Puesto[];
  puestoId: number | "all" | null;
  zoneType: ZoneType | "";
  service: ServiceType | "";
  search: string;
  creating: boolean;
  onPuestoChange: (id: number) => void;
  onZoneTypeChange: (v: ZoneType | "") => void;
  onServiceChange: (v: ServiceType | "") => void;
  onSearchChange: (v: string) => void;
  onClear: () => void;
  onNewZone: () => void;
}

export function ZoneFilters({
  puestos,
  puestoId,
  zoneType,
  service,
  search,
  creating,
  onPuestoChange,
  onZoneTypeChange,
  onServiceChange,
  onSearchChange,
  onClear,
  onNewZone,
}: ZoneFiltersProps) {
  return (
    <Card className="gap-0 px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <FilterSelect
          label="Puesto"
          value={puestoId === "all" ? "-1" : puestoId != null ? String(puestoId) : ""}
          onChange={(v) => v && onPuestoChange(Number(v))}
          options={[
            // -1 = todos los puestos (solo visualización; crear pide uno concreto)
            { value: "-1", label: "Todos los puestos" },
            ...puestos.map((p) => ({ value: String(p.id), label: p.name })),
          ]}
        />

        <FilterSelect
          label="Tipo de zona"
          value={zoneType}
          onChange={(v) => onZoneTypeChange(v as ZoneType | "")}
          options={[
            { value: "", label: "Todos" },
            { value: "DISTRIBUCION", label: "Distribución" },
            { value: "FLETE", label: "Flete" },
          ]}
        />

        <FilterSelect
          label="Tipo de servicio"
          value={service}
          onChange={(v) => onServiceChange(v as ServiceType | "")}
          options={[
            { value: "", label: "Todos" },
            { value: "URGENTE", label: "Urgente" },
            { value: "SERVICE", label: "Service" },
            { value: "NOCTURNO", label: "Nocturno" },
          ]}
        />

        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Buscar zona
          </label>
          <div className="relative">
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nombre..."
              className="pr-9"
            />
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClear}>
            <Brush className="size-4" />
            Limpiar filtros
          </Button>
          <Button onClick={onNewZone} disabled={creating}>
            {creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {creating ? "Dibujando..." : "Nueva zona"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
