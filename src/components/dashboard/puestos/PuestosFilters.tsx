"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DepartamentoOpcion } from "@/lib/types/puesto";
import type { FiltrosPuestos } from "./helpers";

interface Props {
  valores: FiltrosPuestos;
  departamentos: DepartamentoOpcion[];
  onChange: (parcial: Partial<FiltrosPuestos>) => void;
  onAplicar: () => void;
  onLimpiar: () => void;
  hayFiltros: boolean;
}

export default function PuestosFilters({
  valores,
  departamentos,
  onChange,
  onAplicar,
  onLimpiar,
  hayFiltros,
}: Props) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <form
          className="flex flex-col gap-4 xl:flex-row xl:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            onAplicar();
          }}
        >
          <div className="min-w-0 flex-1">
            <Label htmlFor="puestos-search" className="sr-only">
              Buscar puesto
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="puestos-search"
                value={valores.search}
                onChange={(e) => onChange({ search: e.target.value })}
                placeholder="Buscar puesto, departamento o dirección..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="f-estado" className="text-xs text-muted-foreground">
                Estado
              </Label>
              <Select
                value={valores.estado}
                onValueChange={(v) => onChange({ estado: v })}
              >
                <SelectTrigger id="f-estado" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="A">Activo</SelectItem>
                  <SelectItem value="P">Pasivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-depto" className="text-xs text-muted-foreground">
                Departamento
              </Label>
              <Select
                value={valores.departamentoId}
                onValueChange={(v) => onChange({ departamentoId: v })}
              >
                <SelectTrigger id="f-depto" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.nombre ?? `Departamento ${d.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-zona" className="text-xs text-muted-foreground">
                Con zona
              </Label>
              <Select
                value={valores.conZona}
                onValueChange={(v) => onChange({ conZona: v })}
              >
                <SelectTrigger id="f-zona" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="con">Con zona</SelectItem>
                  <SelectItem value="sin">Sin zona</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-moviles" className="text-xs text-muted-foreground">
                Con móviles
              </Label>
              <Select
                value={valores.conMoviles}
                onValueChange={(v) => onChange({ conMoviles: v })}
              >
                <SelectTrigger id="f-moviles" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="con">Con móviles</SelectItem>
                  <SelectItem value="sin">Sin móviles</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button type="submit" className="gap-2">
              <Search className="size-4" />
              Aplicar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onLimpiar}
              disabled={!hayFiltros}
              className="gap-2"
            >
              <X className="size-4" />
              Limpiar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
