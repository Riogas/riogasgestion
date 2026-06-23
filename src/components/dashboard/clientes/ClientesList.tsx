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
  Star,
  Mail,
  SearchX,
  RefreshCw,
  Plus,
} from "lucide-react";
import { useClientes } from "@/hooks/clientes";
import { type Cliente } from "@/lib/types/cliente";
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
// `estado` es un código CHAR(1) de GeneXus (A=Activo, I=Inactivo, P=Pendiente…).

const ESTADO_META: Record<
  string,
  { label: string; variant: "success" | "secondary" | "warn" }
> = {
  A: { label: "Activo", variant: "success" },
  I: { label: "Inactivo", variant: "secondary" },
  P: { label: "Pendiente", variant: "warn" },
  B: { label: "Baja", variant: "secondary" },
};

function estadoMeta(code: string | null) {
  return (
    (code ? ESTADO_META[code] : undefined) ?? {
      label: code || "—",
      variant: "secondary" as const,
    }
  );
}

// Verificación de coordenadas: ✓ verde si la calle coincide, ✗ rojo si difiere,
// — gris si todavía no se verificó la geoinversa.
function GpsCheck({ c }: { c: Cliente }) {
  if (c.calleMatch === true) {
    return (
      <span
        className="text-green-600 font-bold"
        title={`Coincide · ${c.direccion ?? ""}`}
      >
        ✓
      </span>
    );
  }
  if (c.calleMatch === false) {
    return (
      <span
        className="text-red-600 font-bold"
        title={`Calle distinta · tenía «${c.direccion ?? "?"}» · geoinversa: «${c.calleGeo ?? "?"}»`}
      >
        ✗
      </span>
    );
  }
  return (
    <span className="text-muted-foreground/50" title="Sin verificar">
      —
    </span>
  );
}

// Fecha ISO → dd/mm/aaaa (es-UY), "—" si null/ inválida
function fmtFecha(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-UY");
}

// ─── Column grid template (must match header and rows exactly) ────────────────

const GRID_COLS =
  "104px 1fr 56px 112px 120px 1fr 72px 112px 120px";

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

  // ── Stats (derivados de la página actual; el total es server-side) ─────────
  const stats: PageStatItem[] = useMemo(() => {
    const pageActivos = clientes.filter((c) => c.estado === "A").length;
    const pagePendientes = clientes.filter((c) => c.estado === "P").length;
    const pageVip = clientes.filter((c) => c.vip === true).length;
    const pageEmail = clientes.filter((c) => !!c.email).length;
    return [
      {
        id: "total",
        label: "Total clientes",
        value: total.toLocaleString("es-UY"),
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
        id: "vip",
        label: "VIP (pág.)",
        value: String(pageVip),
        icon: Star,
        variant: "primary",
      },
      {
        id: "email",
        label: "Con email (pág.)",
        value: String(pageEmail),
        icon: Mail,
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
            <table className="w-full min-w-[960px] text-sm">
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
                  className="sticky top-0 z-10 bg-background border-b border-border/60 min-w-[960px]"
                  style={{
                    display: "grid",
                    gridTemplateColumns: GRID_COLS,
                  }}
                >
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Nro</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre</div>
                  <div className="px-2 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-center" title="Verificación GPS: ✓ calle coincide, ✗ calle distinta">GPS</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">RUC</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">Zona</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Alta</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Últ. llamada</div>
                </div>

                {/* Scrollable virtual container */}
                <div
                  ref={parentRef}
                  className="overflow-y-auto min-w-[960px]"
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
                      const est = estadoMeta(c.estado);

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
                            {c.id}
                          </div>
                          <div className="px-4 py-2.5 font-medium whitespace-nowrap overflow-hidden text-ellipsis text-sm">
                            {c.nombre || "—"}
                          </div>
                          <div className="px-2 py-2.5 text-center text-sm">
                            <GpsCheck c={c} />
                          </div>
                          <div className="px-4 py-2.5">
                            <Badge variant={est.variant} className="text-[11px]">
                              {est.label}
                            </Badge>
                          </div>
                          <div className="px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                            {c.ruc || "—"}
                          </div>
                          <div className="px-4 py-2.5 text-muted-foreground overflow-hidden text-ellipsis text-sm whitespace-nowrap">
                            {c.email || "—"}
                          </div>
                          <div className="px-4 py-2.5 text-center tabular-nums text-muted-foreground text-sm">
                            {c.zona ?? "—"}
                          </div>
                          <div className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                            {fmtFecha(c.fechaAlta)}
                          </div>
                          <div className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                            {fmtFecha(c.fechaUltimaLlamada)}
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
      <th className="px-4 py-3 font-medium w-28">Estado</th>
      <th className="px-4 py-3 font-medium w-28">RUC</th>
      <th className="px-4 py-3 font-medium">Email</th>
      <th className="px-4 py-3 font-medium w-20 text-center">Zona</th>
      <th className="px-4 py-3 font-medium w-28">Alta</th>
      <th className="px-4 py-3 font-medium w-28">Últ. llamada</th>
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
