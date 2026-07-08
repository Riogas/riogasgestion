"use client";

import { Slider } from "@/components/ui/slider";

export interface WorkbenchFiltersValue {
  /** "" = Todos */
  tipo: string;
  /** "" = Todos */
  estado: string;
  /** 0..1 */
  minConfianza: number;
}

interface WorkbenchFiltersProps {
  value: WorkbenchFiltersValue;
  onChange: (value: WorkbenchFiltersValue) => void;
}

export function WorkbenchFilters({ value, onChange }: WorkbenchFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
      <select
        value={value.tipo}
        onChange={(e) => onChange({ ...value, tipo: e.target.value })}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        aria-label="Filtrar por tipo"
      >
        <option value="">Tipo: todos</option>
        <option value="DUPLICADO">Duplicado</option>
        <option value="HOGAR">Hogar</option>
      </select>

      <select
        value={value.estado}
        onChange={(e) => onChange({ ...value, estado: e.target.value })}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        aria-label="Filtrar por estado"
      >
        <option value="">Estado: todos</option>
        <option value="PENDIENTE">Pendiente</option>
        <option value="ACEPTADO">Aceptado</option>
        <option value="RECHAZADO">Rechazado</option>
      </select>

      <div className="flex items-center gap-2 min-w-[200px]">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Confianza mín.{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {Math.round(value.minConfianza * 100)}%
          </span>
        </span>
        <Slider
          value={[value.minConfianza]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={([v]) => onChange({ ...value, minConfianza: v })}
          className="w-28"
          aria-label="Confianza mínima"
        />
      </div>
    </div>
  );
}
