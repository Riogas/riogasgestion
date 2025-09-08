"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListHeader } from "@/components/abm/ListHeader";
import { TableCard } from "@/components/abm/TableCard";
import { Pager } from "@/components/abm/Pager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DynamicMapa = dynamic(() => import("@/components/mapa/OpenStreetMap"), { ssr: false });

export type Servicio = {
  id: string;
  nroServicio: string;
  fechaPara: string;
  telefono: string;
  movil?: string;
  producto: string;
  estado: string;
  defecto?: string; // Descripcion
  zona?: string;
  atraso?: string | number;
  observaciones?: string;
  // direccion principal
  departamento?: string;
  localidad?: string;
  calle?: string;
  nroPuerta?: string;
  esquina1?: string;
  esquina2?: string;
  block?: string;
  apto?: string;
  direccionCompleta?: string;
};

const mockServicios: Servicio[] = Array.from({ length: 20 }).map((_, i) => ({
  id: String(i + 1),
  nroServicio: String(5000 + i),
  fechaPara: new Date().toISOString(),
  telefono: "099 555 66" + (i % 10),
  movil: i % 2 ? "M-20" + i : "",
  producto: i % 2 ? "Mantenimiento" : "Reparación",
  estado: i % 3 === 0 ? "Pendiente" : i % 3 === 1 ? "En curso" : "Cerrado",
  defecto: i % 2 ? "Pérdida en flexible" : "No enciende",
  zona: "Z" + (i % 4),
  atraso: i * 3,
  observaciones: i % 2 ? "Cliente no atiende" : "Coordinar franja horaria",
  // direccion
  departamento: i % 2 === 0 ? "Montevideo" : "Canelones",
  localidad: i % 2 === 0 ? "Centro" : "Las Piedras",
  calle: i % 2 === 0 ? "Av. Italia" : "Av. Artigas",
  nroPuerta: String(1500 + i),
  esquina1: i % 2 === 0 ? "Bvar. Artigas" : "Colonia",
  esquina2: i % 2 === 0 ? "Mateo Vidal" : "Ejido",
  block: i % 3 === 0 ? "B" : i % 3 === 1 ? "A" : "",
  apto: i % 4 === 0 ? "1202" : i % 4 === 1 ? "3B" : "",
  direccionCompleta: `Av. Italia ${1500 + i}, Montevideo, Uruguay`,
}));

const ALL = "__all__"; // sentinel para "Todos"

function unique<T extends string | number | undefined>(arr: (T | null | undefined)[]) {
  return Array.from(new Set(arr.filter(Boolean) as T[]));
}

export default function Services() {
  const [items] = useState<Servicio[]>(mockServicios);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ direccion?: string; obs?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Servicio | null>(null);
  const onCreate = () => { /* TODO: Crear Servicio */ };

  const [filters, setFilters] = useState({
    fechaDesde: "",
    fechaHasta: "",
    telefono: "",
    movil: "",
    producto: "",
    estado: "",
    defecto: "",
    zona: "",
    atrasoMin: "",
    atrasoMax: "",
  });

  type ServicioFilters = typeof filters;
  type ServicioPreset = { id: string; name: string; filters: Omit<ServicioFilters, "fechaDesde" | "fechaHasta"> };
  const [presets, setPresets] = useState<ServicioPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const formatDtLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };
  const setTodayIfEmpty = () => {
    if (!filters.fechaDesde && !filters.fechaHasta) {
      const now = new Date();
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setHours(23, 59, 0, 0);
      setFilters((f) => ({ ...f, fechaDesde: formatDtLocal(start), fechaHasta: formatDtLocal(end) }));
    }
  };

  useEffect(() => {
    try {
      const pr = localStorage.getItem("services_filter_presets");
      if (pr) setPresets(JSON.parse(pr));
    } catch {}
  }, []);
  useEffect(() => { setTodayIfEmpty(); }, [filters.fechaDesde, filters.fechaHasta]);
  useEffect(() => {
    try { localStorage.setItem("services_filter_presets", JSON.stringify(presets)); } catch {}
  }, [presets]);

  const saveCurrentAsPreset = () => {
    const name = typeof window !== "undefined" ? window.prompt("Nombre del preset de filtros:") : null;
    if (!name) return;
    const { fechaDesde, fechaHasta, ...rest } = filters;
    const id = `${Date.now()}`;
    const preset: ServicioPreset = { id, name, filters: rest };
    setPresets((ps) => [...ps, preset]);
    setSelectedPresetId(id);
  };
  const applyPreset = (id: string) => {
    setSelectedPresetId(id);
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setFilters((prev) => ({ ...prev, ...p.filters }));
  };
  const deletePreset = (id: string) => {
    setPresets((ps) => ps.filter((x) => x.id !== id));
    if (selectedPresetId === id) setSelectedPresetId("");
  };

  const options = useMemo(() => ({
    moviles: unique(items.map(i => i.movil).map(v => v || "—")),
    productos: unique(items.map(i => i.producto)),
    estados: unique(items.map(i => i.estado)),
    zonas: unique(items.map(i => i.zona).map(v => v || "—")),
  }), [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((p) => {
      const matchesSearch = !s || [p.nroServicio, p.telefono, p.movil, p.producto, p.estado, p.zona, p.defecto]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s));

      const fd = filters.fechaDesde ? new Date(filters.fechaDesde).getTime() : undefined;
      const fh = filters.fechaHasta ? new Date(filters.fechaHasta).getTime() : undefined;
      const fp = Date.parse(p.fechaPara);
      const matchFecha = (!fd || fp >= fd) && (!fh || fp <= fh);

      const matchTelefono = !filters.telefono || p.telefono.includes(filters.telefono);
      const matchMovil = !filters.movil || (p.movil || "—") === filters.movil;
      const matchProducto = !filters.producto || p.producto === filters.producto;
      const matchEstado = !filters.estado || p.estado === filters.estado;
      const matchDefecto = !filters.defecto || (p.defecto || "").toLowerCase().includes(filters.defecto.toLowerCase());
      const matchZona = !filters.zona || (p.zona || "—") === filters.zona;
      const min = filters.atrasoMin ? Number(filters.atrasoMin) : undefined;
      const max = filters.atrasoMax ? Number(filters.atrasoMax) : undefined;
      const matchAtraso = (min === undefined || Number(p.atraso ?? 0) >= min) && (max === undefined || Number(p.atraso ?? 0) <= max);

      return matchesSearch && matchFecha && matchTelefono && matchMovil && matchProducto && matchEstado && matchDefecto && matchZona && matchAtraso;
    });
  }, [items, q, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  const activeChips = useMemo(() => {
    const entries = Object.entries(filters).filter(([_, v]) => Boolean(v));
    return entries.map(([k, v]) => ({ key: k, label: `${k}: ${v}` }));
  }, [filters]);

  const clearOne = (key: keyof typeof filters) => setFilters((prev) => ({ ...prev, [key]: "" }));
  const clearAll = () => setFilters({
    fechaDesde: "",
    fechaHasta: "",
    telefono: "",
    movil: "",
    producto: "",
    estado: "",
    defecto: "",
    zona: "",
    atrasoMin: "",
    atrasoMax: "",
  });

  const formatDireccion = (s?: Servicio) => {
    if (!s) return "";
    const partes: string[] = [];
    const calleNro = [s.calle, s.nroPuerta].filter(Boolean).join(" ");
    if (calleNro) partes.push(calleNro);
    const entre = [s.esquina1, s.esquina2].filter(Boolean).join(" y ");
    if (entre) partes.push(`Entre ${entre}`);
    const blockApto = [s.block ? `Block ${s.block}` : "", s.apto ? `Apto ${s.apto}` : ""].filter(Boolean).join(" • ");
    if (blockApto) partes.push(blockApto);
    const locDepto = [s.localidad, s.departamento].filter(Boolean).join(" / ");
    if (locDepto) partes.push(locDepto);
    return partes.join(" — ");
  };

  return (
    <TableCard
      header={
        <ListHeader
          title="Services"
          search={q}
          onSearch={(v) => { setQ(v); setPage(1); }}
          onCreate={onCreate}
          createLabel="Nuevo"
          rightExtra={
            <Button variant="outline" onClick={() => setShowFilters((s) => !s)}>
              <Filter className="w-4 h-4 mr-2" />
              {activeChips.length ? `Filtros (${activeChips.length})` : "Filtros"}
            </Button>
          }
        />
      }
    >
      {showFilters && (
        <div className="mb-3 rounded-md border border-border/40 p-3 bg-background/50">
          {/* Presets de filtros */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Preset</Label>
              <Select value={selectedPresetId || ""} onValueChange={applyPreset}>
                <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Seleccionar preset" /></SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={saveCurrentAsPreset}>Guardar actual</Button>
              {selectedPresetId && (
                <Button variant="outline" size="sm" onClick={() => deletePreset(selectedPresetId)}>Borrar</Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            <div className="col-span-1 sm:col-span-3 xl:col-span-3">
              <Label className="text-xs text-muted-foreground">Fecha Para (desde)</Label>
              <Input className="h-8 text-xs" type="datetime-local" value={filters.fechaDesde} onChange={(e) => setFilters((f) => ({ ...f, fechaDesde: e.target.value }))} />
            </div>
            <div className="col-span-1 sm:col-span-3 xl:col-span-3">
              <Label className="text-xs text-muted-foreground">Fecha Para (hasta)</Label>
              <Input className="h-8 text-xs" type="datetime-local" value={filters.fechaHasta} onChange={(e) => setFilters((f) => ({ ...f, fechaHasta: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Teléfono</Label>
              <Input className="h-8 text-xs" value={filters.telefono} onChange={(e) => setFilters((f) => ({ ...f, telefono: e.target.value }))} placeholder="099..." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Movil</Label>
              <Select value={filters.movil || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, movil: v === ALL ? "" : v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {options.moviles.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Producto</Label>
              <Select value={filters.producto || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, producto: v === ALL ? "" : v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {options.productos.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select value={filters.estado || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, estado: v === ALL ? "" : v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {options.estados.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Defecto (contiene)</Label>
              <Input className="h-8 text-xs" value={filters.defecto} onChange={(e) => setFilters((f) => ({ ...f, defecto: e.target.value }))} placeholder="texto..." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Zona</Label>
              <Select value={filters.zona || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, zona: v === ALL ? "" : v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {options.zonas.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Atraso (min)</Label>
              <Input className="h-8 text-xs" type="number" value={filters.atrasoMin} onChange={(e) => setFilters((f) => ({ ...f, atrasoMin: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Atraso (max)</Label>
              <Input className="h-8 text-xs" type="number" value={filters.atrasoMax} onChange={(e) => setFilters((f) => ({ ...f, atrasoMax: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-3">
            <Button variant="secondary" size="sm" onClick={clearAll}>Limpiar</Button>
            <Button size="sm" onClick={() => setShowFilters(false)}>Aplicar</Button>
          </div>
        </div>
      )}

      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeChips.map((c) => (
            <Badge key={c.key} variant="secondary" className="px-2 py-1">
              {c.label}
              <button className="ml-2 inline-flex" onClick={() => clearOne(c.key as keyof typeof filters)}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll}>Quitar todos</Button>
        </div>
      )}

      {/* Hover info bar (fixed height) */}
      <div className="mb-2 rounded border border-border bg-muted/20 px-3 h-10 flex items-center">
        {hoverInfo?.direccion || hoverInfo?.obs ? (
          <div className="flex gap-6 min-w-0 w-full items-center">
            <div className="min-w-0 truncate">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-2">Dirección</span>
              <span className="text-sm text-foreground font-medium leading-tight">{hoverInfo?.direccion || "—"}</span>
            </div>
            {hoverInfo?.obs && (
              <div className="min-w-0 truncate">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-2">Obs.</span>
                <span className="text-sm text-foreground leading-tight">{hoverInfo.obs}</span>
              </div>
            )}
          </div>
        ) : (
          <span className="opacity-0 text-sm">placeholder</span>
        )}
      </div>

      <div className="overflow-x-auto" onMouseLeave={() => setHoverInfo(null)}>
        <Table className="text-sm min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Nro Servicio</TableHead>
              <TableHead>Fecha Para</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Movil</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Defecto (Descripcion)</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead className="text-right">Atraso</TableHead>
              <TableHead>Observaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((p) => (
              <TableRow
                key={p.id}
                className="hover:bg-muted/40 cursor-pointer"
                onMouseEnter={() => setHoverInfo({ direccion: formatDireccion(p) || p.direccionCompleta || "", obs: p.observaciones })}
                onClick={() => { setSelected(p); setOpen(true); }}
              >
                <TableCell className="font-medium whitespace-nowrap">{p.nroServicio}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(p.fechaPara).toLocaleString()}</TableCell>
                <TableCell className="whitespace-nowrap">{p.telefono}</TableCell>
                <TableCell className="whitespace-nowrap">{p.movil || "—"}</TableCell>
                <TableCell>{p.producto}</TableCell>
                <TableCell>
                  <Badge className={p.estado === "Cerrado" ? "bg-emerald-600 text-white" : p.estado === "En curso" ? "bg-amber-500 text-white" : "bg-gray-500 text-white"}>
                    {p.estado}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[240px] truncate" title={p.defecto}>{p.defecto || "—"}</TableCell>
                <TableCell>{p.zona || "—"}</TableCell>
                <TableCell className="text-right">{p.atraso ?? "—"}</TableCell>
                <TableCell className="max-w-[260px] truncate" title={p.observaciones}>{p.observaciones || "—"}</TableCell>
              </TableRow>
            ))}
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de detalle */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelected(null); }}>
        <DialogContent className="p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-3 border-b">
            <DialogTitle className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span>Servicio {selected?.nroServicio}</span>
                {selected?.estado && (
                  <Badge variant="secondary" className="text-xs">{selected.estado}</Badge>
                )}
              </div>
            </DialogTitle>
            <DialogDescription>
              {selected?.fechaPara ? new Date(selected.fechaPara).toLocaleString() : ""}
            </DialogDescription>
            {selected?.telefono && (
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground mr-1">Teléfono</span>
                  <span className="font-medium">{selected.telefono}</span>
                </div>
                {selected?.movil && (
                  <div>
                    <span className="text-muted-foreground mr-1">Móvil</span>
                    <span className="font-medium">{selected.movil}</span>
                  </div>
                )}
              </div>
            )}
          </DialogHeader>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Izquierda: dirección, mapa, observaciones */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-md border p-4 bg-background">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Dirección</div>
                <div className="space-y-1">
                  <div className="text-base font-medium">
                    {selected && (selected.calle || selected.nroPuerta) ? (
                      <>
                        <span>{[selected.calle, selected.nroPuerta].filter(Boolean).join(" ") || "—"}</span>{" "}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  {(selected?.esquina1 || selected?.esquina2) && (
                    <div className="text-sm text-muted-foreground">Entre { [selected?.esquina1, selected?.esquina2].filter(Boolean).join(" y ") }</div>
                  )}
                  {(selected?.block || selected?.apto) && (
                    <div className="text-sm text-muted-foreground">{[selected?.block ? `Block ${selected.block}` : "", selected?.apto ? `Apto ${selected.apto}` : ""].filter(Boolean).join(" • ")}</div>
                  )}
                  {(selected?.localidad || selected?.departamento) && (
                    <div className="text-sm text-muted-foreground">{[selected?.localidad, selected?.departamento].filter(Boolean).join(" / ")}</div>
                  )}
                </div>
              </div>

              <div className="rounded-md border p-2 bg-background">
                <DynamicMapa
                  departamento={selected?.departamento}
                  localidad={selected?.localidad || ""}
                  direccion={selected?.calle || ""}
                  nroPuerta={selected?.nroPuerta || ""}
                  esquina1={selected?.esquina1 || ""}
                  esquina2={selected?.esquina2 || ""}
                  zonas={[]}
                  mapHeightPx={300}
                />
              </div>

              <div className="rounded-md border p-4 bg-background">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Observaciones</div>
                <div className="text-sm whitespace-pre-wrap">{selected?.observaciones || "—"}</div>
              </div>
            </div>

            {/* Derecha: detalle */}
            <div className="space-y-4">
              <div className="rounded-md border p-4 bg-background">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">Detalle</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Producto</div><div className="font-medium">{selected?.producto || "—"}</div>
                  <div className="text-muted-foreground">Estado</div><div className="font-medium">{selected?.estado || "—"}</div>
                  <div className="text-muted-foreground">Zona</div><div className="font-medium">{selected?.zona || "—"}</div>
                  <div className="text-muted-foreground">Defecto</div><div className="font-medium">{selected?.defecto || "—"}</div>
                </div>
              </div>

              <div className="rounded-md border p-4 bg-background">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">Tiempos</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Fecha para</div><div className="font-medium">{selected?.fechaPara ? new Date(selected.fechaPara).toLocaleString() : "—"}</div>
                  <div className="text-muted-foreground">Atraso</div><div className="font-medium">{selected?.atraso ?? "—"}</div>
                </div>
              </div>

              <div className="rounded-md border p-4 bg-background">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">Origen</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Móvil</div><div className="font-medium">{selected?.movil || "—"}</div>
                  <div className="text-muted-foreground">Teléfono</div><div className="font-medium">{selected?.telefono || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Pager
        page={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        onFirst={() => setPage(1)}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        onLast={() => setPage(totalPages)}
        onChangePageSize={(n) => { setPageSize(n); setPage(1); }}
      />
    </TableCard>
  );
}
