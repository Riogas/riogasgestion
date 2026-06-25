"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Truck,
  Navigation,
  Clock,
  SignalLow,
  Signal,
  SignalZero,
  Plus,
  Settings2,
  Warehouse,
  FileSpreadsheet,
  Search,
  RefreshCw,
  ArrowUpDown,
  Pencil,
  Cog,
  History,
  MoreVertical,
  SearchX,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  useMoviles,
  useMovilKpis,
  useMovilFiltros,
  useMovil,
} from "@/hooks/moviles";
import {
  estadoBadge,
  servicioBadge,
  gpsBadge,
  type MovilListItem,
} from "@/lib/types/movil";

// ─── Debounce ─────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Utils ─────────────────────────────────────────────────────────────────────

function fmtFecha(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

// TODO: cablear write/modales en fase posterior (alta, lote, obelix, histórico).
function todo(label: string) {
  // eslint-disable-next-line no-alert
  alert(`${label}: pendiente de implementar (fase de escritura).`);
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Truck;
  accent: string;
}) {
  return (
    <Card className="flex-row items-center gap-4 px-5 py-4">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${accent}`}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-bold leading-tight text-foreground tabular-nums">
          {value}
        </p>
      </div>
    </Card>
  );
}

// ─── Panel lateral ─────────────────────────────────────────────────────────────

function PanelLateral({ id }: { id: number | null }) {
  const { data: m, isLoading } = useMovil(id);

  if (!id) {
    return (
      <Card className="px-5">
        <EmptyState
          icon={Truck}
          size="sm"
          title="Móvil seleccionado"
          description="Seleccioná una fila de la tabla para ver el detalle del móvil."
        />
      </Card>
    );
  }

  if (isLoading || !m) {
    return (
      <Card className="gap-4 px-5">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
        ))}
      </Card>
    );
  }

  const est = estadoBadge(m.estadoNombre);
  const srv = servicioBadge(m.tipoServicio ?? m.servicioPrincipal);
  const gps = gpsBadge(m.tieneGps);

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Matrícula", value: m.matricula || "—" },
    { label: "Empresa fletera", value: m.fleteraNombre || "—" },
    {
      label: "Estado",
      value: <Badge variant={est.variant}>{est.label}</Badge>,
    },
    {
      label: "Servicio",
      value: (
        <Badge variant={srv.variant} className={srv.className}>
          {srv.label}
        </Badge>
      ),
    },
    { label: "Cap. bodega 13kg", value: m.capacidadLote ?? "—" },
    { label: "Pedidos pendientes", value: m.pedidosPendientes ?? "—" },
    {
      label: "Lote",
      value:
        m.capacidadLote != null ? (
          <Badge variant="default">{m.capacidadLote}</Badge>
        ) : (
          "—"
        ),
    },
    {
      label: "GPS",
      value: <Badge variant={gps.variant}>{gps.label}</Badge>,
    },
    { label: "Teléfono", value: m.telefono || "—" },
    { label: "Destino", value: m.destinoNombre || "—" },
    { label: "Últ. actualización", value: fmtFecha(m.ultimaActualizacion) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-4 px-5">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Móvil seleccionado
            </p>
            <p className="text-3xl font-bold tabular-nums text-foreground">
              {m.numero ?? "—"}
            </p>
          </div>
          <Badge variant="outline" className="capitalize">
            {m.origen}
          </Badge>
        </div>

        <dl className="flex flex-col divide-y divide-border/60 text-sm">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3 py-2"
            >
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="text-right font-medium text-foreground">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="gap-3 px-5">
        <p className="text-sm font-semibold text-foreground">
          Histórico de estados
        </p>
        <EmptyState
          icon={History}
          size="sm"
          title="Sin histórico registrado"
          description="No hay movimientos de estado cargados para este móvil."
        />
        <Button variant="outline" size="sm" disabled className="w-full">
          Ver historial completo
        </Button>
      </Card>
    </div>
  );
}

// ─── Acción con tooltip ────────────────────────────────────────────────────────

function IconAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

export default function Moviles() {
  const router = useRouter();

  // URL state (nuqs)
  const [searchInput, setSearchInput] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  );
  const [page, setPage] = useQueryState("p", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState(
    "ps",
    parseAsInteger.withDefault(20),
  );
  const [estadoCodigo, setEstadoCodigo] = useQueryState(
    "estado",
    parseAsString.withDefault(""),
  );
  const [tipoServicio, setTipoServicio] = useQueryState(
    "servicio",
    parseAsString.withDefault(""),
  );
  const [fleteraId, setFleteraId] = useQueryState(
    "fletera",
    parseAsString.withDefault(""),
  );
  const [rutaIca, setRutaIca] = useQueryState(
    "ica",
    parseAsString.withDefault(""),
  );
  const [sort, setSort] = useQueryState("sort", parseAsString.withDefault(""));
  const [sel, setSel] = useQueryState("sel", parseAsInteger);

  const debouncedSearch = useDebounce(searchInput, 400);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch || undefined,
      estadoCodigo: estadoCodigo ? Number(estadoCodigo) : undefined,
      tipoServicio: tipoServicio || undefined,
      fleteraId: fleteraId ? Number(fleteraId) : undefined,
      rutaIca: rutaIca || undefined,
      sort: sort || undefined,
    }),
    [
      page,
      pageSize,
      debouncedSearch,
      estadoCodigo,
      tipoServicio,
      fleteraId,
      rutaIca,
      sort,
    ],
  );

  const { data, isLoading, isError, refetch, isFetching } = useMoviles(params);
  const { data: kpis } = useMovilKpis();
  const { data: filtros } = useMovilFiltros();

  const moviles: MovilListItem[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);

  const toggleSortMovil = () => {
    setSort((prev) => (prev === "movil" ? "-movil" : "movil"));
    setPage(1);
  };

  const limpiar = () => {
    setSearchInput("");
    setEstadoCodigo("");
    setTipoServicio("");
    setFleteraId("");
    setRutaIca("");
    setSort("");
    setPage(1);
  };

  const exportarCsv = () => {
    const headers = [
      "Movil",
      "Matricula",
      "Empresa fletera",
      "Estado",
      "Servicio",
      "Pendientes",
      "Lote",
      "OK",
      "GPS",
      "Observaciones",
      "Ultima actualizacion",
    ];
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = moviles.map((m) =>
      [
        m.numero,
        m.matricula,
        m.fleteraNombre,
        m.estadoNombre,
        m.tipoServicio,
        m.pedidosPendientes,
        m.capacidadLote,
        m.ok,
        m.tieneGps ? "Con GPS" : "Sin GPS",
        m.observaciones,
        fmtFecha(m.ultimaActualizacion),
      ]
        .map(escape)
        .join(","),
    );
    const csv = [headers.map(escape).join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moviles-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    {
      label: "Total móviles",
      value: (kpis?.total ?? 0).toLocaleString("es-UY"),
      icon: Truck,
      accent: "bg-primary/10 text-primary",
    },
    {
      label: "Activos en viaje",
      value: String(kpis?.activosEnViaje ?? 0),
      icon: Navigation,
      accent: "bg-success/10 text-success",
    },
    {
      label: "En espera",
      value: String(kpis?.enEspera ?? 0),
      icon: Clock,
      accent: "bg-warn/10 text-warn",
    },
    {
      label: "Sin GPS",
      value: String(kpis?.sinGps ?? 0),
      icon: SignalLow,
      accent: "bg-destructive/10 text-destructive",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Breadcrumb + título + acciones */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <nav className="text-xs text-muted-foreground">
            Inicio <span className="px-1">/</span> Logística{" "}
            <span className="px-1">/</span>{" "}
            <span className="text-foreground">Móviles</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Administración de móviles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Flota unificada (interior + capital): estado, servicio, GPS y
            pedidos por unidad.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => todo("Nuevo móvil")}>
            <Plus className="size-4" />
            Nuevo móvil
          </Button>
          <Button variant="secondary" onClick={() => todo("Configuración Obelix")}>
            <Settings2 className="size-4" />
            Configuración Obelix
          </Button>
          <Button variant="secondary" onClick={() => todo("Ver bodega")}>
            <Warehouse className="size-4" />
            Ver bodega
          </Button>
          <Button variant="outline" onClick={exportarCsv}>
            <FileSpreadsheet className="size-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Filtros */}
      <Card className="gap-4 px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Matrícula, nº de móvil…"
                className="pl-9"
              />
            </div>
          </div>

          <FilterSelect
            label="Estado"
            value={estadoCodigo}
            onChange={(v) => {
              setEstadoCodigo(v);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todos" },
              ...(filtros?.estados ?? []).map((e) => ({
                value: String(e.codigo),
                label: e.nombre,
              })),
            ]}
          />

          <FilterSelect
            label="Servicio"
            value={tipoServicio}
            onChange={(v) => {
              setTipoServicio(v);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todos" },
              ...(filtros?.servicios ?? []).map((s) => ({
                value: s,
                label: s,
              })),
            ]}
          />

          <FilterSelect
            label="Empresa fletera"
            value={fleteraId}
            onChange={(v) => {
              setFleteraId(v);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todas" },
              ...(filtros?.fleteras ?? []).map((f) => ({
                value: String(f.id),
                label: f.nombre ?? `#${f.id}`,
              })),
            ]}
          />

          <FilterSelect
            label="Ruta ICA"
            value={rutaIca}
            onChange={(v) => {
              setRutaIca(v);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todas" },
              { value: "si", label: "Con ruta ICA" },
              { value: "no", label: "Sin ruta ICA" },
            ]}
          />

          <div className="flex items-center gap-2">
            <Button variant="default" onClick={() => refetch()}>
              {isFetching ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Aplicar
            </Button>
            <Button variant="outline" onClick={limpiar}>
              Limpiar
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border/60 pt-3">
          <Button variant="secondary" size="sm" onClick={() => todo("Modificar lote")}>
            <Layers className="size-4" />
            Modificar lote
          </Button>
          <Button variant="secondary" size="sm" onClick={() => todo("Histórico")}>
            <History className="size-4" />
            Histórico
          </Button>
        </div>
      </Card>

      {/* Grid principal: tabla + panel */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        {/* Tabla */}
        <Card className="overflow-hidden p-0">
          {isError ? (
            <div className="py-16">
              <EmptyState
                icon={RefreshCw}
                title="Error al cargar móviles"
                description="No se pudo conectar con el servidor. Verificá tu conexión."
                action={
                  <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="size-4" />
                    Reintentar
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>
                        <button
                          onClick={toggleSortMovil}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          Móvil
                          <ArrowUpDown className="size-3" />
                        </button>
                      </TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Empresa fletera</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Servicio</TableHead>
                      <TableHead className="text-right">#Pend</TableHead>
                      <TableHead className="text-right">#Lote</TableHead>
                      <TableHead className="text-center">OK?</TableHead>
                      <TableHead>GPS</TableHead>
                      <TableHead>Observaciones</TableHead>
                      <TableHead>Últ. actualización</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading &&
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 13 }).map((__, j) => (
                            <TableCell key={j}>
                              <div className="h-4 w-full animate-pulse rounded bg-muted" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}

                    {!isLoading &&
                      moviles.map((m) => {
                        const est = estadoBadge(m.estadoNombre);
                        const srv = servicioBadge(m.tipoServicio);
                        const selected = sel === m.id;
                        return (
                          <TableRow
                            key={m.id}
                            data-state={selected ? "selected" : undefined}
                            className="cursor-pointer"
                            onClick={() => router.push(`/dashboard/moviles/${m.id}`)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() =>
                                  setSel(selected ? null : m.id)
                                }
                                aria-label={`Seleccionar móvil ${m.numero}`}
                              />
                            </TableCell>
                            <TableCell className="font-semibold tabular-nums">
                              {m.numero ?? "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {m.matricula || "—"}
                            </TableCell>
                            <TableCell className="max-w-[180px] truncate">
                              {m.fleteraNombre || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={est.variant}>{est.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={srv.variant}
                                className={srv.className}
                              >
                                {srv.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {m.pedidosPendientes ?? "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {m.capacidadLote != null ? (
                                <Badge variant="default">
                                  {m.capacidadLote}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {m.ok === "S" ? (
                                <span className="font-bold text-success">S</span>
                              ) : (
                                <span className="text-muted-foreground">N</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {m.tieneGps ? (
                                <span className="inline-flex items-center gap-1 text-success">
                                  <Signal className="size-4" />
                                  <span className="text-xs">Con GPS</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-destructive">
                                  <SignalZero className="size-4" />
                                  <span className="text-xs">Sin GPS</span>
                                </span>
                              )}
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate text-muted-foreground"
                              title={m.observaciones || ""}
                            >
                              {m.observaciones || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {fmtFecha(m.ultimaActualizacion)}
                            </TableCell>
                            <TableCell
                              className="text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="inline-flex">
                                <IconAction
                                  icon={Pencil}
                                  label="Editar"
                                  onClick={() =>
                                    router.push(`/dashboard/moviles/${m.id}`)
                                  }
                                />
                                <IconAction
                                  icon={Cog}
                                  label="Configurar"
                                  onClick={() =>
                                    router.push(`/dashboard/moviles/${m.id}`)
                                  }
                                />
                                <IconAction
                                  icon={History}
                                  label="Historial"
                                  onClick={() =>
                                    todo(`Historial móvil ${m.numero}`)
                                  }
                                />
                                <IconAction
                                  icon={MoreVertical}
                                  label="Más acciones"
                                  onClick={() => todo(`Más · móvil ${m.numero}`)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              {!isLoading && moviles.length === 0 && (
                <EmptyState
                  icon={SearchX}
                  size="default"
                  title="Sin móviles para mostrar"
                  description={
                    debouncedSearch
                      ? `No encontramos resultados para "${debouncedSearch}".`
                      : "No hay móviles que coincidan con los filtros."
                  }
                />
              )}

              {/* Footer */}
              <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
                <p className="text-xs text-muted-foreground">
                  Mostrando{" "}
                  <span className="font-medium text-foreground">{desde}</span> a{" "}
                  <span className="font-medium text-foreground">{hasta}</span> de{" "}
                  <span className="font-medium text-foreground">
                    {total.toLocaleString("es-UY")}
                  </span>
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Filas:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      aria-label="Filas por página"
                    >
                      {[20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page <= 1}
                      onClick={() => setPage(1)}
                    >
                      <ChevronsLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="px-2 text-xs text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)}
                    >
                      <ChevronsRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Panel lateral */}
        <PanelLateral id={sel ?? null} />
      </div>
    </div>
  );
}

// ─── Select de filtro (nativo, estética dark) ──────────────────────────────────

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
