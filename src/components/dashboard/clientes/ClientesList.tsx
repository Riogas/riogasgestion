"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  AlertTriangle,
} from "lucide-react";
import { useClientes } from "@/hooks/clientes";
import { estadoLabel, estadoVariant, type Cliente } from "@/lib/types/cliente";
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

function dirPrincipal(c: Cliente) {
  return c.direcciones.find((d) => d.principal) ?? c.direcciones[0];
}

// Verificación de coordenadas (calleMatch de la dirección principal):
// ✓ verde coincide, ✗ rojo difiere, "s/coord" si null (interior sin coordenadas).
function GpsCheck({ c }: { c: Cliente }) {
  const dir = dirPrincipal(c);
  const match = dir?.calleMatch ?? null;
  if (match === true) {
    return (
      <span className="text-green-600 font-bold" title={`Coincide · ${dir?.direccion ?? ""}`}>
        ✓
      </span>
    );
  }
  if (match === false) {
    return (
      <span className="text-red-600 font-bold" title="Calle distinta a la geoinversa">
        ✗
      </span>
    );
  }
  return (
    <span className="text-muted-foreground/50 text-[10px]" title="Sin coordenadas">
      s/coord
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
  "96px 88px 1fr 64px 112px 130px 1fr 120px 100px 110px";

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
  // Por defecto filtra Activos (reduce el set de 1.13M y acelera la lista).
  // El usuario puede elegir "Estado: todos" para ver todo.
  const [estado, setEstado] = useQueryState("estado", parseAsString.withDefault("A"));
  const [origen, setOrigen] = useQueryState("origen", parseAsString.withDefault(""));

  // ── Debounced search → params ─────────────────────────────────────────────
  // C3: debounce with 400ms; clearing resets page immediately
  const debouncedSearch = useDebounce(searchInput, 400);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch || undefined,
      estado: estado || undefined,
      origen: origen || undefined,
    }),
    [page, pageSize, debouncedSearch, estado, origen],
  );

  const { data, isLoading, isError, refetch, isFetching } =
    useClientes(params);

  const clientes: Cliente[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

  const handleEstado = (v: string) => {
    setEstado(v);
    setPage(1);
  };

  const handleOrigen = (v: string) => {
    setOrigen(v);
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
            placeholder="Nombre, teléfono, dirección, RUC o cédula…"
            rightExtra={
              <div className="flex items-center gap-2">
                {isFetching && !isLoading && (
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <select
                  value={origen}
                  onChange={(e) => handleOrigen(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  aria-label="Filtrar por origen"
                >
                  <option value="">Origen: todos</option>
                  <option value="capital">Capital</option>
                  <option value="interior">Interior</option>
                </select>
                <select
                  value={estado}
                  onChange={(e) => handleEstado(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  aria-label="Filtrar por estado"
                >
                  <option value="">Estado: todos</option>
                  <option value="A">Activo</option>
                  <option value="I">Inactivo</option>
                  <option value="P">Pendiente</option>
                  <option value="R">Revisión</option>
                </select>
                <Button size="sm" asChild className="shrink-0">
                  <Link href="/dashboard/clientes/nuevo">
                    <Plus className="h-4 w-4 mr-1" />
                    Nuevo
                  </Link>
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
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Origen</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre</div>
                  <div className="px-2 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-center" title="Verificación GPS: ✓ calle coincide, ✗ calle distinta, s/coord sin coordenadas">GPS</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">RUC/Cédula</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</div>
                  <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Localidad</div>
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
                      const dir = dirPrincipal(c);

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
                          <div className="px-4 py-2.5">
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {c.origen}
                            </Badge>
                          </div>
                          <div className="px-4 py-2.5 font-medium whitespace-nowrap overflow-hidden text-ellipsis text-sm flex items-center gap-1">
                            {c.dedupRevisar && (
                              <AlertTriangle
                                className="size-3.5 text-amber-500 shrink-0"
                                aria-label="Posible duplicado"
                              />
                            )}
                            <span className="truncate">{c.nombre || "—"}</span>
                          </div>
                          <div className="px-2 py-2.5 text-center text-sm">
                            <GpsCheck c={c} />
                          </div>
                          <div className="px-4 py-2.5">
                            <Badge variant={estadoVariant(c.estado)} className="text-[11px]">
                              {estadoLabel(c.estado)}
                            </Badge>
                          </div>
                          <div className="px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                            {c.ruc || c.cedula || "—"}
                          </div>
                          <div className="px-4 py-2.5 text-muted-foreground overflow-hidden text-ellipsis text-sm whitespace-nowrap">
                            {c.email || "—"}
                          </div>
                          <div className="px-4 py-2.5 text-muted-foreground overflow-hidden text-ellipsis text-sm whitespace-nowrap">
                            {dir?.localidadId ?? "—"}
                          </div>
                          <div className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                            {fmtFecha(c.fechaAlta)}
                          </div>
                          <div className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                            {fmtFecha(c.ultimaLlamada)}
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
    </>
  );
}

// ─── Sub-components (skeleton uses valid table HTML — no virtualizer) ─────────

function ColumnHeaders() {
  return (
    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
      <th className="px-4 py-3 font-medium w-24">Nro</th>
      <th className="px-4 py-3 font-medium w-20">Origen</th>
      <th className="px-4 py-3 font-medium">Nombre</th>
      <th className="px-4 py-3 font-medium w-16 text-center">GPS</th>
      <th className="px-4 py-3 font-medium w-28">Estado</th>
      <th className="px-4 py-3 font-medium w-28">RUC/Cédula</th>
      <th className="px-4 py-3 font-medium">Email</th>
      <th className="px-4 py-3 font-medium w-28">Localidad</th>
      <th className="px-4 py-3 font-medium w-28">Alta</th>
      <th className="px-4 py-3 font-medium w-28">Últ. llamada</th>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border/40">
      {[24, 18, 40, 14, 20, 24, 36, 24, 24, 24].map((w, i) => (
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
