"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCard } from "@/components/abm/TableCard";
import { Pager } from "@/components/abm/Pager";
import { ListHeader } from "@/components/abm/ListHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageStats, type PageStatItem } from "@/components/ui/PageStats";
import {
  Users,
  UserCheck,
  UserPlus,
  Building2,
  CalendarPlus,
  SearchX,
  RefreshCw,
  Plus,
} from "lucide-react";
import { useClientes } from "@/hooks/clientes";
import {
  EstadoCliente,
  TipoCliente,
  type Cliente,
} from "@/lib/types/cliente";
import { AltaSlideOver } from "@/components/clientes/AltaSlideOver";
import Link from "next/link";

// ─── Debounce hook — C2: standard useEffect pattern, no setState in render ────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<
  EstadoCliente,
  "success" | "secondary" | "warn"
> = {
  [EstadoCliente.ACTIVO]: "success",
  [EstadoCliente.INACTIVO]: "secondary",
  [EstadoCliente.PENDIENTE]: "warn",
};

const ESTADO_LABEL: Record<EstadoCliente, string> = {
  [EstadoCliente.ACTIVO]: "Activo",
  [EstadoCliente.INACTIVO]: "Inactivo",
  [EstadoCliente.PENDIENTE]: "Pendiente",
};

const TIPO_LABEL: Record<TipoCliente, string> = {
  [TipoCliente.DOMESTICO]: "Doméstico",
  [TipoCliente.COMERCIAL]: "Comercial",
};

// ─── Column grid template (must match header and rows exactly) ────────────────

const GRID_COLS =
  "96px 1fr 112px 112px 1fr 144px 80px 112px";

// ─── Main component ──────────────────────────────────────────────────────────

export default function ClientesList() {
  const router = useRouter();

  // ── URL state (nuqs) ──────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  );
  const [page, setPage] = useQueryState("p", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState(
    "ps",
    parseAsInteger.withDefault(20),
  );

  // ── Debounced search → params ─────────────────────────────────────────────
  // C3: debounce with 400ms; clearing resets page immediately
  const debouncedSearch = useDebounce(searchInput, 400);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch || undefined,
    }),
    [page, pageSize, debouncedSearch],
  );

  const { data, isLoading, isError, refetch, isFetching } =
    useClientes(params);

  const clientes: Cliente[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── Slide-over state ──────────────────────────────────────────────────────
  const [slideOverOpen, setSlideOverOpen] = useState(false);

  // ── Virtualizer — C1: parentRef points to the scrollable div ─────────────
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: clientes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  // ── Stats (derived from paginated totals — server-side values not in data)
  const stats: PageStatItem[] = useMemo(() => {
    const pageActivos = clientes.filter(
      (c) => c.estado === EstadoCliente.ACTIVO,
    ).length;
    const pagePendientes = clientes.filter(
      (c) => c.estado === EstadoCliente.PENDIENTE,
    ).length;
    const pageComerciales = clientes.filter(
      (c) => c.tipoCliente === TipoCliente.COMERCIAL,
    ).length;
    const pageRecientes = clientes.filter((c) => {
      const days =
        (Date.now() - new Date(c.createdAt).getTime()) / 86_400_000;
      return days < 7;
    }).length;
    return [
      {
        id: "total",
        label: "Total clientes",
        value: String(total),
        icon: Users,
        variant: "primary",
      },
      {
        id: "activos",
        label: "Activos (pág.)",
        value: String(pageActivos),
        icon: UserCheck,
        variant: "success",
      },
      {
        id: "pend",
        label: "Pendientes (pág.)",
        value: String(pagePendientes),
        icon: UserPlus,
        variant: "warn",
      },
      {
        id: "comerc",
        label: "Comerciales (pág.)",
        value: String(pageComerciales),
        icon: Building2,
        variant: "primary",
      },
      {
        id: "rec",
        label: "Últimos 7 días",
        value: String(pageRecientes),
        icon: CalendarPlus,
        variant: "success",
      },
    ];
  }, [clientes, total]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // C3: clear resets page to 1 immediately (debounce will resolve "" in 400ms,
  // but the search is empty so that is fine — no stale timer issues because
  // each useEffect call cancels the previous timeout).
  const handleSearch = (v: string) => {
    setSearchInput(v);
    setPage(1);
  };

  const handleChangePageSize = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  // ── Skeleton rows ─────────────────────────────────────────────────────────

  const skeletonRows = Array.from({ length: pageSize > 20 ? 20 : pageSize });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageStats items={stats} />

      <TableCard
        header={
          <ListHeader
            search={searchInput}
            onSearch={handleSearch}
            rightExtra={
              <div className="flex items-center gap-2">
                {isFetching && !isLoading && (
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="text-xs"
                >
                  <Link href="/dashboard/clientes/nuevo">Alta detallada</Link>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSlideOverOpen(true)}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo
                </Button>
              </div>
            }
          />
        }
      >
        {/* ── Loading skeleton (table is valid HTML — not virtualised) ── */}
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

        {/* ── Error state ── */}
        {isError && !isLoading && (
          <div className="py-16 flex flex-col items-center gap-4">
            <EmptyState
              icon={RefreshCw}
              title="Error al cargar clientes"
              description="No se pudo conectar con el servidor. Verificá tu conexión."
              action={
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reintentar
                </Button>
              }
            />
          </div>
        )}

        {/* ── Virtualised list — C1: div-based, no table inside ── */}
        {!isLoading && !isError && (
          <>
            {clientes.length === 0 ? (
              <EmptyState
                icon={SearchX}
                size="default"
                title="Sin clientes para mostrar"
                description={
                  debouncedSearch
                    ? `No encontramos resultados para "${debouncedSearch}".`
                    : "Aún no hay clientes cargados."
                }
                action={
                  debouncedSearch ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearch("")}
                    >
                      Limpiar búsqueda
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                {/* Sticky column header — div grid */}
                <div
                  className="sticky top-0 z-10 bg-background border-b border-border/60 min-w-[900px]"
                  style={{
                    display: "grid",
                    gridTemplateColumns: GRID_COLS,
                  }}
                >
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Nro</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Teléfono</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">#Dir</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Últ. modif.</div>
                </div>

                {/* Scrollable virtual container */}
                <div
                  ref={parentRef}
                  className="overflow-y-auto min-w-[900px]"
                  style={{ maxHeight: "calc(100vh - 420px)", minHeight: 200 }}
                >
                  {/* Total height spacer for virtualizer */}
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      position: "relative",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const c = clientes[virtualRow.index];
                      const primaryPhone =
                        c.telefonos.find((t) => t.esPrincipal)?.numero ??
                        c.telefonos[0]?.numero ??
                        "—";
                      const estadoVariant =
                        ESTADO_BADGE[c.estado] ?? "secondary";

                      return (
                        <div
                          key={c.id}
                          data-index={virtualRow.index}
                          ref={virtualizer.measureElement}
                          onClick={() =>
                            router.push(`/dashboard/clientes/${c.id}`)
                          }
                          className="cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualRow.start}px)`,
                            display: "grid",
                            gridTemplateColumns: GRID_COLS,
                            alignItems: "center",
                          }}
                        >
                          <div className="px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                            {c.nroCliente ?? "—"}
                          </div>
                          <div className="px-4 py-2.5 font-medium whitespace-nowrap overflow-hidden text-ellipsis text-sm">
                            {c.nombre}
                            {c.apellido ? ` ${c.apellido}` : ""}
                          </div>
                          <div className="px-4 py-2.5 whitespace-nowrap">
                            <Badge variant="secondary" className="text-[11px]">
                              {TIPO_LABEL[c.tipoCliente]}
                            </Badge>
                          </div>
                          <div className="px-4 py-2.5">
                            <Badge
                              variant={estadoVariant}
                              className="text-[11px]"
                            >
                              {ESTADO_LABEL[c.estado]}
                            </Badge>
                          </div>
                          <div className="px-4 py-2.5 text-muted-foreground overflow-hidden text-ellipsis text-sm whitespace-nowrap">
                            {c.email || "—"}
                          </div>
                          <div className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-sm">
                            {primaryPhone}
                          </div>
                          <div className="px-4 py-2.5 text-center tabular-nums text-muted-foreground text-sm">
                            {c.direcciones.length}
                          </div>
                          <div className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                            {c.fechaUltModif
                              ? new Date(c.fechaUltModif).toLocaleDateString(
                                  "es-UY",
                                )
                              : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Pagination ── */}
        {!isLoading && !isError && clientes.length > 0 && (
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
        )}
      </TableCard>

      {/* ── Alta slide-over ── */}
      <AltaSlideOver
        open={slideOverOpen}
        onOpenChange={setSlideOverOpen}
      />
    </>
  );
}

// ─── Sub-components (skeleton uses valid table HTML — no virtualizer) ─────────

function ColumnHeaders() {
  return (
    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
      <th className="px-4 py-3 font-medium w-24">Nro</th>
      <th className="px-4 py-3 font-medium">Nombre</th>
      <th className="px-4 py-3 font-medium w-28">Tipo</th>
      <th className="px-4 py-3 font-medium w-28">Estado</th>
      <th className="px-4 py-3 font-medium">Email</th>
      <th className="px-4 py-3 font-medium w-36">Teléfono</th>
      <th className="px-4 py-3 font-medium w-20 text-center">#Dir</th>
      <th className="px-4 py-3 font-medium w-28">Últ. modif.</th>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border/40">
      {[24, 40, 20, 20, 36, 24, 12, 24].map((w, i) => (
        <td key={i} className="px-4 py-2.5">
          <div
            className="h-4 rounded bg-muted animate-pulse"
            style={{ width: `${w * 4}px`, maxWidth: "100%" }}
          />
        </td>
      ))}
    </tr>
  );
}
