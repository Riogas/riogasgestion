"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
  Building2,
  CheckCircle2,
  Truck,
  MapPin,
  Plus,
  Map,
  FileSpreadsheet,
  Search,
  RefreshCw,
  Pencil,
  Eye,
  MoreVertical,
  SearchX,
  MessageSquare,
  Send,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  useFleteras,
  useFleteraKpis,
  useFleteraFiltros,
  useFletera,
} from "@/hooks/fleteras";
import {
  estadoFleteraBadge,
  type FleteraListItem,
} from "@/lib/types/fletera";

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

// TODO: cablear write/detalle/mensaje/zonas en fase posterior.
function todo(label: string) {
  // eslint-disable-next-line no-alert
  alert(`${label}: pendiente de implementar (fase posterior).`);
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
  icon: typeof Building2;
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
        <p className="text-[11px] text-muted-foreground">—</p>
      </div>
    </Card>
  );
}

// ─── Panel lateral ─────────────────────────────────────────────────────────────

function PanelLateral({ id }: { id: number | null }) {
  const router = useRouter();
  const { data: f, isLoading } = useFletera(id);

  if (!id) {
    return (
      <Card className="px-5">
        <EmptyState
          icon={Building2}
          size="sm"
          title="Empresa seleccionada"
          description="Seleccioná una fila de la tabla para ver el detalle de la empresa."
        />
      </Card>
    );
  }

  if (isLoading || !f) {
    return (
      <Card className="gap-4 px-5">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
        ))}
      </Card>
    );
  }

  const est = estadoFleteraBadge(f.estado);

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Puesto", value: f.puestoNombre || "—" },
    { label: "Teléfono", value: f.telefono || "—" },
    { label: "Calle", value: f.calle || "—" },
    { label: "Móviles activos", value: f.movilesActivos },
    { label: "Móviles no activos", value: f.movilesNoActivos },
    { label: "Últ. actualización", value: fmtFecha(f.ultimaFecha) },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Empresa seleccionada */}
      <Card className="gap-4 px-5">
        <div className="flex items-baseline justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Empresa seleccionada
            </p>
            <p className="truncate text-lg font-bold text-foreground">
              {f.nombre || "—"}
            </p>
            <p className="text-xs text-muted-foreground">ID {f.idOriginal}</p>
          </div>
          <Badge variant={est.variant}>{est.label}</Badge>
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

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => todo(`Editar empresa ${f.nombre}`)}
          >
            <Pencil className="size-4" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => todo(`Ver detalle ${f.nombre}`)}
          >
            <Eye className="size-4" />
            Ver detalle
          </Button>
        </div>
      </Card>

      {/* 2. Móviles de la empresa */}
      <Card className="gap-3 px-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Móviles de la empresa
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/moviles?fletera=${f.id}`)}
          >
            <Truck className="size-4" />
            Ver móviles
          </Button>
        </div>

        {f.moviles.length === 0 ? (
          <EmptyState
            icon={Truck}
            size="sm"
            title="Sin móviles"
            description="Esta empresa no tiene móviles asociados."
          />
        ) : (
          <ul className="flex max-h-64 flex-col divide-y divide-border/60 overflow-y-auto text-sm">
            {f.moviles.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="font-semibold tabular-nums text-foreground">
                    {m.numero ?? "—"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.conductor || "—"}
                  </p>
                </div>
                <Badge variant={m.activo ? "success" : "secondary"}>
                  {m.activo ? "Activo" : "No activo"}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => todo("Enviar mensaje al móvil")}
        >
          <Send className="size-4" />
          Enviar mensaje al móvil
        </Button>
      </Card>

      {/* 3. Alerta pedidos pendientes (stub) */}
      <Card className="gap-2 px-5">
        <p className="text-sm font-semibold text-foreground">
          Pedidos pendientes
        </p>
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          <MessageSquare className="size-4 shrink-0" />
          <span>Pedidos: módulo no conectado.</span>
        </div>
      </Card>

      {/* 4. Zonas asociadas */}
      <Card className="gap-3 px-5">
        <p className="text-sm font-semibold text-foreground">
          Zonas asociadas
        </p>
        {f.zonas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin zonas para el puesto de esta empresa.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {f.zonas.map((z) => (
              <Badge key={z} variant="outline">
                {z}
              </Badge>
            ))}
          </div>
        )}
        <Separator />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => todo("Consultar zonas")}
        >
          <Map className="size-4" />
          Consultar zonas
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

export default function EmpresasFleteras() {
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
  const [estado, setEstado] = useQueryState(
    "estado",
    parseAsString.withDefault(""),
  );
  const [puestoId, setPuestoId] = useQueryState(
    "puesto",
    parseAsString.withDefault(""),
  );
  const [conMoviles, setConMoviles] = useQueryState(
    "moviles",
    parseAsString.withDefault(""),
  );
  const [sel, setSel] = useQueryState("sel", parseAsInteger);

  const debouncedSearch = useDebounce(searchInput, 400);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch || undefined,
      estado: estado || undefined,
      puestoId: puestoId ? Number(puestoId) : undefined,
      conMoviles: conMoviles || undefined,
    }),
    [page, pageSize, debouncedSearch, estado, puestoId, conMoviles],
  );

  const { data, isLoading, isError, refetch, isFetching } = useFleteras(params);
  const { data: kpis } = useFleteraKpis();
  const { data: filtros } = useFleteraFiltros();

  const fleteras: FleteraListItem[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);

  const limpiar = () => {
    setSearchInput("");
    setEstado("");
    setPuestoId("");
    setConMoviles("");
    setPage(1);
  };

  const exportarCsv = () => {
    const headers = [
      "Puesto",
      "Id",
      "Nombre",
      "Telefono",
      "Calle",
      "Estado",
      "Cant. moviles",
      "Activos",
      "Ultima fecha",
    ];
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = fleteras.map((f) =>
      [
        f.puestoNombre,
        f.idOriginal,
        f.nombre,
        f.telefono,
        f.calle,
        estadoFleteraBadge(f.estado).label,
        f.cantMoviles,
        f.activos,
        fmtFecha(f.ultimaFecha),
      ]
        .map(escape)
        .join(","),
    );
    const csv = [headers.map(escape).join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `empresas-fleteras-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    {
      label: "Total empresas",
      value: (kpis?.total ?? 0).toLocaleString("es-UY"),
      icon: Building2,
      accent: "bg-primary/10 text-primary",
    },
    {
      label: "Empresas activas",
      value: (kpis?.activas ?? 0).toLocaleString("es-UY"),
      icon: CheckCircle2,
      accent: "bg-success/10 text-success",
    },
    {
      label: "Móviles asociados",
      value: (kpis?.movilesAsociados ?? 0).toLocaleString("es-UY"),
      icon: Truck,
      accent: "bg-chart-4/10 text-chart-4",
    },
    {
      label: "Puestos cubiertos",
      value: (kpis?.puestosCubiertos ?? 0).toLocaleString("es-UY"),
      icon: MapPin,
      accent: "bg-warn/10 text-warn",
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
            <span className="text-foreground">Empresas fleteras</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Empresas fleteras
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administración de empresas fleteras (interior + capital): estado,
            puesto, móviles y zonas asociadas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => todo("Nueva empresa")}>
            <Plus className="size-4" />
            Nueva empresa
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push("/dashboard/moviles")}
          >
            <Truck className="size-4" />
            Ver móviles
          </Button>
          <Button variant="secondary" onClick={() => todo("Ver zonas")}>
            <Map className="size-4" />
            Ver zonas
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
              Buscar empresa
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Nombre de la empresa…"
                className="pl-9"
              />
            </div>
          </div>

          <FilterSelect
            label="Estado"
            value={estado}
            onChange={(v) => {
              setEstado(v);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todos" },
              ...(filtros?.estados ?? []).map((e) => ({
                value: e.value,
                label: e.label,
              })),
            ]}
          />

          <FilterSelect
            label="Puesto"
            value={puestoId}
            onChange={(v) => {
              setPuestoId(v);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todos" },
              ...(filtros?.puestos ?? []).map((p) => ({
                value: String(p.id),
                label: p.nombre ?? `#${p.id}`,
              })),
            ]}
          />

          <FilterSelect
            label="Con móviles"
            value={conMoviles}
            onChange={(v) => {
              setConMoviles(v);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todas" },
              { value: "con-activos", label: "Con móviles activos" },
              { value: "sin-activos", label: "Con móviles, sin activos" },
              { value: "sin", label: "Sin móviles" },
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
      </Card>

      {/* Grid principal: tabla + panel */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        {/* Tabla */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              Listado de empresas
            </p>
          </div>
          {isError ? (
            <div className="py-16">
              <EmptyState
                icon={RefreshCw}
                title="Error al cargar empresas"
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
                <Table className="min-w-[1000px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Puesto</TableHead>
                      <TableHead>Id</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Calle</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Cant. móviles</TableHead>
                      <TableHead className="text-right"># Activos</TableHead>
                      <TableHead>Últ. fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading &&
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 11 }).map((__, j) => (
                            <TableCell key={j}>
                              <div className="h-4 w-full animate-pulse rounded bg-muted" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}

                    {!isLoading &&
                      fleteras.map((f) => {
                        const est = estadoFleteraBadge(f.estado);
                        const selected = sel === f.id;
                        return (
                          <TableRow
                            key={f.id}
                            data-state={selected ? "selected" : undefined}
                            className="cursor-pointer"
                            onClick={() => setSel(selected ? null : f.id)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() =>
                                  setSel(selected ? null : f.id)
                                }
                                aria-label={`Seleccionar empresa ${f.nombre}`}
                              />
                            </TableCell>
                            <TableCell className="max-w-[140px] truncate">
                              {f.puestoNombre || "—"}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {f.idOriginal}
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate font-medium">
                              {f.nombre || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {f.telefono || "—"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                              {f.calle || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={est.variant}>{est.label}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {f.cantMoviles}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {f.activos > 0 ? (
                                <span className="font-semibold text-success">
                                  {f.activos}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {fmtFecha(f.ultimaFecha)}
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
                                    todo(`Editar empresa ${f.nombre}`)
                                  }
                                />
                                <IconAction
                                  icon={Eye}
                                  label="Ver detalle"
                                  onClick={() =>
                                    todo(`Ver detalle ${f.nombre}`)
                                  }
                                />
                                <IconAction
                                  icon={Truck}
                                  label="Ver móviles"
                                  onClick={() =>
                                    router.push(
                                      `/dashboard/moviles?fletera=${f.id}`,
                                    )
                                  }
                                />
                                <IconAction
                                  icon={MoreVertical}
                                  label="Más acciones"
                                  onClick={() => todo(`Más · ${f.nombre}`)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              {!isLoading && fleteras.length === 0 && (
                <EmptyState
                  icon={SearchX}
                  size="default"
                  title="Sin empresas para mostrar"
                  description={
                    debouncedSearch
                      ? `No encontramos resultados para "${debouncedSearch}".`
                      : "No hay empresas que coincidan con los filtros."
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
    <div className="min-w-[160px]">
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
