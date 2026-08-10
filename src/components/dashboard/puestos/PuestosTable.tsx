"use client";

import { Building2, Check, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PaginatedPuestos, Puesto } from "@/lib/types/puesto";
import {
  claseZona,
  esActivo,
  formatFecha,
  formatNullable,
  mapEstado,
  VACIO,
} from "./helpers";

interface Props {
  data?: PaginatedPuestos;
  loading: boolean;
  seleccionadoId: number | null;
  onSeleccionar: (id: number) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onLimpiarFiltros: () => void;
  hayFiltros: boolean;
}

const COLUMNAS = [
  "Nombre / departamento",
  "Dirección",
  "Zona asignada",
  "Móviles",
  "Estado",
  "Últ. actualización",
];

function FilaSkeleton() {
  return (
    <TableRow>
      <TableCell className="w-10">
        <div className="size-5 animate-pulse rounded-full bg-muted" />
      </TableCell>
      {COLUMNAS.map((c) => (
        <TableCell key={c}>
          <div className="h-4 w-full max-w-[160px] animate-pulse rounded bg-muted" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export default function PuestosTable({
  data,
  loading,
  seleccionadoId,
  onSeleccionar,
  onPageChange,
  onPageSizeChange,
  onLimpiarFiltros,
  hayFiltros,
}: Props) {
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 10;
  const totalPages = data?.totalPages ?? 1;

  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          Listado de puestos{" "}
          <span className="text-muted-foreground">({formatearTotal(total, loading)})</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10" />
                {COLUMNAS.map((c) => (
                  <TableHead
                    key={c}
                    className="whitespace-nowrap text-[11px] uppercase tracking-wide"
                  >
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && items.length === 0 ? (
                Array.from({ length: 6 }, (_, i) => <FilaSkeleton key={i} />)
              ) : items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COLUMNAS.length + 1} className="py-10">
                    <EmptyState
                      icon={SearchX}
                      title="No se encontraron puestos con los filtros seleccionados."
                      size="sm"
                      action={
                        hayFiltros ? (
                          <Button variant="outline" size="sm" onClick={onLimpiarFiltros}>
                            Limpiar filtros
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p) => (
                  <Fila
                    key={p.id}
                    puesto={p}
                    seleccionado={p.id === seleccionadoId}
                    onSeleccionar={onSeleccionar}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? "Sin puestos para mostrar"
              : `Mostrando ${desde} a ${hasta} de ${total} puestos`}
          </p>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label="Página anterior"
              >
                ‹
              </Button>
              {paginas(page, totalPages).map((n) => (
                <Button
                  key={n}
                  variant={n === page ? "default" : "outline"}
                  size="sm"
                  className="min-w-9 tabular-nums"
                  onClick={() => onPageChange(n)}
                  aria-current={n === page ? "page" : undefined}
                >
                  {n}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                aria-label="Página siguiente"
              >
                ›
              </Button>
            </div>

            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="w-[130px]" aria-label="Puestos por página">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} por página
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatearTotal(total: number, loading: boolean): string {
  return loading ? "…" : String(total);
}

/** Ventana de 5 páginas alrededor de la actual, para no romper con 50 páginas. */
function paginas(actual: number, total: number): number[] {
  const desde = Math.max(1, Math.min(actual - 2, total - 4));
  const hasta = Math.min(total, desde + 4);
  const out: number[] = [];
  for (let i = Math.max(1, desde); i <= hasta; i++) out.push(i);
  return out;
}

function Fila({
  puesto,
  seleccionado,
  onSeleccionar,
}: {
  puesto: Puesto;
  seleccionado: boolean;
  onSeleccionar: (id: number) => void;
}) {
  const activo = esActivo(puesto.estado);

  return (
    <TableRow
      onClick={() => onSeleccionar(puesto.id)}
      aria-selected={seleccionado}
      className={cn(
        "cursor-pointer border-l-2 border-l-transparent",
        seleccionado && "border-l-primary bg-primary/5 hover:bg-primary/10",
      )}
    >
      <TableCell className="w-10">
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full border transition-colors",
            seleccionado
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border",
          )}
        >
          {seleccionado && <Check className="size-3.5" />}
        </span>
      </TableCell>

      <TableCell className="max-w-[220px]">
        <p className="truncate font-medium">{puesto.nombre ?? "Sin nombre"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {puesto.departamentoNombre
            ? `Depto. ${puesto.departamentoNombre}`
            : "Sin departamento"}
        </p>
      </TableCell>

      <TableCell className="max-w-[220px]">
        {puesto.direccion ? (
          <>
            <p className="truncate">{puesto.direccion}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatNullable(puesto.localidadNombre ?? puesto.departamentoNombre)}
            </p>
          </>
        ) : (
          <span className="text-muted-foreground">{VACIO}</span>
        )}
      </TableCell>

      <TableCell>
        {puesto.zonasOperativas > 0 ? (
          <Badge variant="outline" className={cn("font-normal", claseZona(puesto.zonaNombre))}>
            {puesto.zonasOperativas === 1 && puesto.zonaNombre
              ? puesto.zonaNombre
              : `${puesto.zonasOperativas} zonas`}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-border bg-muted/40 font-normal text-muted-foreground"
          >
            Sin zona
          </Badge>
        )}
      </TableCell>

      <TableCell className="tabular-nums">
        <span className={cn(puesto.moviles === 0 && "text-muted-foreground")}>
          {puesto.moviles}
        </span>
      </TableCell>

      <TableCell>
        <Badge
          variant="outline"
          className={cn(
            "font-normal",
            activo
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-border bg-muted/40 text-muted-foreground",
          )}
        >
          {mapEstado(puesto.estado)}
        </Badge>
      </TableCell>

      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {formatFecha(puesto.updatedAt)}
      </TableCell>
    </TableRow>
  );
}
