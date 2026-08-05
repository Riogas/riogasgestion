"use client";

import { useMemo, useState } from "react";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { CheckCircle2, Clock, PackageCheck, RefreshCw, SearchX, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/abm/Pager";
import { TableCard } from "@/components/abm/TableCard";
import { SorteosToolbar } from "./SorteosToolbar";
import { useMarcarEntregado, useSorteoParticipaciones } from "@/hooks/sorteos";
import { useDebounce } from "@/hooks/useDebounce";
import type { SorteoDetalle, SorteoParticipacion } from "@/lib/types/sorteo";
import { ConfirmDialog } from "./ConfirmDialog";
import { fmtFechaHora, fmtNumero } from "./helpers";

export function SorteoGanadoresTab({ sorteo }: { sorteo: SorteoDetalle }) {
  const [searchInput, setSearchInput] = useQueryState("gq", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState("gp", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState("gps", parseAsInteger.withDefault(20));
  const [aEntregar, setAEntregar] = useState<SorteoParticipacion | null>(null);

  const debouncedSearch = useDebounce(searchInput, 400);
  const marcarEntregado = useMarcarEntregado();

  const params = useMemo(
    () => ({ page, pageSize, search: debouncedSearch || undefined, soloGanadores: true }),
    [page, pageSize, debouncedSearch],
  );

  const { data, isLoading, isError, refetch, isFetching } = useSorteoParticipaciones(
    sorteo.id,
    params,
  );

  const ganadores = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearch = (v: string) => {
    setSearchInput(v);
    setPage(1);
  };

  const handleChangePageSize = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  const confirmarEntrega = () => {
    if (!aEntregar) return;
    marcarEntregado.mutate(
      { sorteoId: sorteo.id, participacionId: aEntregar.id },
      { onSuccess: () => setAEntregar(null) },
    );
  };

  return (
    <>
      <TableCard
        header={
          <SorteosToolbar
            search={searchInput}
            onSearch={handleSearch}
            searchPlaceholder="Buscar por nombre o teléfono…"
            searchLabel="Buscar ganadores"
            meta={
              <>
                {isFetching && !isLoading && (
                  <RefreshCw
                    className="size-4 animate-spin text-muted-foreground"
                    aria-label="Actualizando"
                  />
                )}
                {/* Los dos números salen de `stats`: `total` está filtrado por
                    la búsqueda y mezclarlos daba ratios sin sentido. */}
                <span className="hidden text-xs text-muted-foreground sm:inline tabular-nums">
                  {fmtNumero(sorteo.stats.premiosEntregados)} de{" "}
                  {fmtNumero(sorteo.stats.ganadores)} premios entregados
                </span>
              </>
            }
          />
        }
      >
        {isLoading && (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-[var(--radius-md)] bg-muted" />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <EmptyState
            icon={RefreshCw}
            title="No se pudieron cargar los ganadores"
            description="Verificá tu conexión y reintentá."
            action={
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="size-4" />
                Reintentar
              </Button>
            }
          />
        )}

        {!isLoading && !isError && ganadores.length === 0 && (
          <EmptyState
            icon={debouncedSearch ? SearchX : Trophy}
            title={debouncedSearch ? "Sin resultados" : "Todavía no hay ganadores"}
            description={
              debouncedSearch
                ? `No encontramos ganadores que coincidan con "${debouncedSearch}".`
                : "Los ganadores aparecen acá apenas alguien participa en un momento premiado."
            }
            action={
              debouncedSearch ? (
                <Button variant="outline" onClick={() => handleSearch("")}>
                  Limpiar búsqueda
                </Button>
              ) : undefined
            }
          />
        )}

        {!isLoading && !isError && ganadores.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-40 px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="w-36 px-4 py-3 font-medium">Teléfono</th>
                    <th className="w-40 px-4 py-3 font-medium">Código de canje</th>
                    <th className="w-56 px-4 py-3 font-medium">Premio</th>
                    <th className="w-48 px-2 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ganadores.map((g) => (
                    <tr
                      key={g.id}
                      className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                        {fmtFechaHora(g.createdAt)}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 font-medium text-foreground">
                        {g.nombre}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums">{g.telefono}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-[var(--radius-sm)] bg-muted px-2 py-1 font-mono text-xs font-semibold tracking-wider text-foreground">
                          {g.codigoCanje ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {g.premioEntregado ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="success" className="w-fit">
                              <CheckCircle2 className="size-3" />
                              Entregado
                            </Badge>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {fmtFechaHora(g.premioEntregadoAt)}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="warn" className="w-fit">
                            <Clock className="size-3" />
                            Pendiente
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {!g.premioEntregado && (
                          <Button variant="outline" size="sm" onClick={() => setAEntregar(g)}>
                            <PackageCheck className="size-4" />
                            Marcar entregado
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
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

      <ConfirmDialog
        open={!!aEntregar}
        onOpenChange={(v) => !v && setAEntregar(null)}
        title="¿Marcar el premio como entregado?"
        description="Queda registrada la fecha de entrega y la acción no se puede deshacer."
        confirmLabel="Marcar entregado"
        confirmIcon={<PackageCheck className="size-4" />}
        pending={marcarEntregado.isPending}
        onConfirm={confirmarEntrega}
      >
        {aEntregar && (
          <dl className="rounded-[var(--radius-md)] border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-3 py-1">
              <dt className="text-muted-foreground">Ganador</dt>
              <dd className="font-medium text-foreground">{aEntregar.nombre}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-1">
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd className="font-mono text-xs tabular-nums text-foreground">
                {aEntregar.telefono}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-1">
              <dt className="text-muted-foreground">Código de canje</dt>
              <dd className="font-mono text-xs font-semibold tracking-wider text-foreground">
                {aEntregar.codigoCanje ?? "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-1">
              <dt className="text-muted-foreground">Premio</dt>
              <dd className="max-w-[60%] text-right font-medium text-foreground">
                {sorteo.premioDescripcion}
              </dd>
            </div>
          </dl>
        )}
      </ConfirmDialog>
    </>
  );
}
