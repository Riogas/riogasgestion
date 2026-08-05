"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { ChevronRight, Gift, Plus, RefreshCw, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCard } from "@/components/abm/TableCard";
import { Pager } from "@/components/abm/Pager";
import { EmptyState } from "@/components/ui/EmptyState";
import { SorteosToolbar } from "./SorteosToolbar";
import { useSorteos } from "@/hooks/sorteos";
import { useDebounce } from "@/hooks/useDebounce";
import {
  ESTADOS_SORTEO,
  esEstadoSorteo,
  estadoSorteoBadge,
  type SorteoListItem,
} from "@/lib/types/sorteo";
import { SorteoFormDialog } from "./SorteoFormDialog";
import { fmtFechaHora, fmtNumero, porcentaje } from "./helpers";

export default function SorteosList() {
  const router = useRouter();

  const [searchInput, setSearchInput] = useQueryState("q", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState("p", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState("ps", parseAsInteger.withDefault(20));
  const [estado, setEstado] = useQueryState("estado", parseAsString.withDefault(""));
  const [nuevoOpen, setNuevoOpen] = useState(false);

  const debouncedSearch = useDebounce(searchInput, 400);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch || undefined,
      estado: esEstadoSorteo(estado) ? estado : undefined,
    }),
    [page, pageSize, debouncedSearch, estado],
  );

  const { data, isLoading, isError, refetch, isFetching } = useSorteos(params);

  const sorteos: SorteoListItem[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearch = (v: string) => {
    setSearchInput(v);
    setPage(1);
  };

  const handleEstado = (v: string) => {
    setEstado(v);
    setPage(1);
  };

  const handleChangePageSize = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  const skeletonRows = Array.from({ length: Math.min(pageSize, 8) });

  return (
    <>
      <TableCard
        header={
          <SorteosToolbar
            search={searchInput}
            onSearch={handleSearch}
            searchPlaceholder="Buscar por nombre o premio…"
            searchLabel="Buscar sorteos"
            filters={
              <Select
                value={estado || "todos"}
                onValueChange={(v) => handleEstado(v === "todos" ? "" : v)}
              >
                <SelectTrigger className="w-44" aria-label="Filtrar por estado">
                  <SelectValue />
                </SelectTrigger>
                {/* Sólido (mismo criterio que el popover de participantes):
                    el glass del primitivo deja leer la tabla de atrás. */}
                <SelectContent className="!bg-popover !border-border shadow-lg">
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {ESTADOS_SORTEO.map((e) => (
                    <SelectItem key={e} value={e}>
                      {estadoSorteoBadge(e).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
            meta={
              isFetching && !isLoading ? (
                <RefreshCw
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  aria-label="Actualizando"
                />
              ) : undefined
            }
            actions={
              <Button className="shrink-0" onClick={() => setNuevoOpen(true)}>
                <Plus className="h-4 w-4" />
                Nuevo sorteo
              </Button>
            }
          />
        }
      >
        {isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <ColumnHeaders />
              </thead>
              <tbody>
                {skeletonRows.map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isError && !isLoading && (
          <EmptyState
            icon={RefreshCw}
            title="Error al cargar los sorteos"
            description="No se pudo conectar con el servidor. Verificá tu conexión."
            action={
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </Button>
            }
          />
        )}

        {!isLoading && !isError && sorteos.length === 0 && (
          <EmptyState
            icon={debouncedSearch || estado ? SearchX : Gift}
            title={
              debouncedSearch || estado ? "Sin resultados" : "Todavía no hay sorteos"
            }
            description={
              debouncedSearch
                ? `No encontramos sorteos que coincidan con "${debouncedSearch}".`
                : estado
                  ? `No hay sorteos en estado ${estadoSorteoBadge(estado).label.toLowerCase()}.`
                  : "Creá el primer sorteo para generar los códigos QR y empezar a recibir participaciones."
            }
            action={
              debouncedSearch || estado ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    handleSearch("");
                    handleEstado("");
                  }}
                >
                  Limpiar filtros
                </Button>
              ) : (
                <Button onClick={() => setNuevoOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Nuevo sorteo
                </Button>
              )
            }
          />
        )}

        {!isLoading && !isError && sorteos.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <ColumnHeaders />
                </thead>
                <tbody>
                  {sorteos.map((s, i) => {
                    const badge = estadoSorteoBadge(s.estado);
                    const pct = porcentaje(s.premiosEntregados, s.cantidadPremios);

                    return (
                      <tr
                        key={s.id}
                        onClick={() => router.push(`/dashboard/sorteos/${s.id}`)}
                        className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40 animate-fade-in-up"
                        style={{ animationDelay: `${Math.min(i, 10) * 0.02}s` }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary">
                              <Gift className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{s.nombre}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {s.premioDescripcion}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                          {fmtFechaHora(s.fechaDesde)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                          {fmtFechaHora(s.fechaHasta)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-36 space-y-1.5">
                            <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
                              <span className="font-medium text-foreground">
                                {fmtNumero(s.premiosEntregados)}/{fmtNumero(s.cantidadPremios)}
                              </span>
                              <span className="text-muted-foreground">{pct}%</span>
                            </div>
                            <Progress
                              value={pct}
                              aria-label={`Premios entregados: ${s.premiosEntregados} de ${s.cantidadPremios}`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {fmtNumero(s._count.participaciones)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                          {fmtNumero(s._count.codigos)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <ChevronRight className="ml-auto size-4 text-muted-foreground/60" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pager
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onFirst={() => setPage(1)}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              onLast={() => setPage(totalPages)}
              onChangePageSize={handleChangePageSize}
            />
          </>
        )}
      </TableCard>

      <SorteoFormDialog
        open={nuevoOpen}
        onOpenChange={setNuevoOpen}
        onCreated={(s) => router.push(`/dashboard/sorteos/${s.id}`)}
      />
    </>
  );
}

function ColumnHeaders() {
  return (
    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
      <th className="px-4 py-3 font-medium">Sorteo</th>
      <th className="w-28 px-4 py-3 font-medium">Estado</th>
      <th className="w-40 px-4 py-3 font-medium">Desde</th>
      <th className="w-40 px-4 py-3 font-medium">Hasta</th>
      <th className="w-44 px-4 py-3 font-medium">Premios entregados</th>
      <th className="w-32 px-4 py-3 text-right font-medium">Participaciones</th>
      <th className="w-28 px-4 py-3 text-right font-medium">Códigos</th>
      <th className="w-10 px-2 py-3" aria-label="Acciones" />
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-9 shrink-0 animate-pulse rounded-[var(--radius-md)] bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-28 animate-pulse rounded bg-muted/70" />
          </div>
        </div>
      </td>
      {[64, 104, 104, 120, 56, 44, 16].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 animate-pulse rounded bg-muted"
            style={{ width: w, maxWidth: "100%" }}
          />
        </td>
      ))}
    </tr>
  );
}
