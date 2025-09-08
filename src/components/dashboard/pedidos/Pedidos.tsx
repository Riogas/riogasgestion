"use client";

import { useMemo, useState, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const DynamicMapa = dynamic(() => import("@/components/mapa/OpenStreetMap"), { ssr: false });

// Tipo base (puedes ajustar luego según API)
export type Pedido = {
  id: string;
  nroPedido: string;
  fechaPara: string; // ISO o legible
  telefono: string;
  movil?: string;
  producto: string;
  cant: number;
  subEstado?: string;
  servicio?: string;
  atraso?: string | number;
  demoraZona?: string | number;
  prioridad?: string | number;
  canal?: string;
  zona?: string;
  formaPago?: string;
  estado: string;
  campania?: string;
  importe?: number;
  direccionCompleta?: string;
  observaciones?: string;
  // nuevos campos de direccion detallada
  departamento?: string;
  localidad?: string;
  calle?: string;
  nroPuerta?: string;
  esquina1?: string;
  esquina2?: string;
  block?: string;
  apto?: string;
};

const mockPedidos: Pedido[] = Array.from({ length: 12 }).map((_, i) => ({
  id: String(i + 1),
  nroPedido: String(1000 + i),
  fechaPara: new Date().toISOString(),
  telefono: "099 123 45" + (i % 10),
  movil: i % 3 === 0 ? "M-10" + i : "",
  producto: i % 2 ? "13kg" : "45kg",
  cant: (i % 4) + 1,
  subEstado: i % 2 ? "En Ruta" : "Pendiente",
  servicio: i % 3 === 0 ? "Urgente" : i % 3 === 1 ? "Especial" : "Normal",
  atraso: i * 2,
  demoraZona: 5 + (i % 5),
  prioridad: i % 3,
  canal: i % 2 ? "Web" : "Tel",
  zona: "Z" + (i % 4),
  formaPago: i % 2 ? "Efectivo" : "Tarjeta",
  estado: i % 2 ? "Activo" : "Pendiente",
  campania: i % 3 ? "Promo" : "",
  importe: 1000 + i * 50,
  // direccion compuesta
  departamento: i % 2 === 0 ? "Montevideo" : "Canelones",
  localidad: i % 2 === 0 ? "Montevideo" : "Las Piedras",
  calle: i % 2 === 0 ? "Av. Italia" : "Av. Artigas",
  nroPuerta: String(1200 + i),
  esquina1: i % 2 === 0 ? "Bvar. Artigas" : "18 de Julio",
  esquina2: i % 2 === 0 ? "Mateo Vidal" : "Ejido",
  block: i % 3 === 0 ? "B" : i % 3 === 1 ? "A" : "",
  apto: i % 4 === 0 ? "1202" : i % 4 === 1 ? "3B" : "",
  direccionCompleta: `Av. Italia ${1200 + i}, Montevideo, Uruguay`,
  observaciones: i % 2 === 0 ? "Dejar en portería. Cliente con perro." : "Sin observaciones",
}));

const ALL = "__all__"; // sentinel para "Todos"

function unique<T extends string | number | undefined>(arr: (T | null | undefined)[]) {
  return Array.from(new Set(arr.filter(Boolean) as T[]));
}

function parseDireccionCompleta(dc?: string) {
  let direccion = "";
  let nroPuerta = "";
  let localidad = "";
  let departamento = "";
  if (!dc) return { direccion, nroPuerta, localidad, departamento };
  const parts = dc.split(",").map((s) => s.trim());
  const first = parts[0];
  const second = parts[1];
  const third = parts[2];
  if (first) {
    const m = first.match(/^(.*)\s+(\d+[A-Za-z\/]*)$/);
    if (m) { direccion = m[1]; nroPuerta = m[2]; } else { direccion = first; }
  }
  if (second) localidad = second;
  if (third && third.toLowerCase() !== "uruguay") departamento = third;
  return { direccion, nroPuerta, localidad, departamento };
}

export default function Pedidos() {
  const [items] = useState<Pedido[]>(mockPedidos);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const onCreate = () => { /* TODO: Crear Pedido */ };
  // New: info of hovered row to show above the table
  const [hoverInfo, setHoverInfo] = useState<{ direccion?: string; obs?: string } | null>(null);
  // New: modal state for row click
  const [selected, setSelected] = useState<Pedido | null>(null);
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseDireccionCompleta(selected?.direccionCompleta || ""), [selected?.direccionCompleta]);
  const mapDepartamento = selected?.departamento || parsed.departamento;
  const mapLocalidad = selected?.localidad || parsed.localidad;
  const mapDireccion = selected?.calle || parsed.direccion;
  const mapNro = selected?.nroPuerta || parsed.nroPuerta;

  // Filtros avanzados (colapsables)
  const [filters, setFilters] = useState({
    fechaDesde: "",
    fechaHasta: "",
    telefono: "",
    movil: "",
    producto: "",
    subEstado: "",
    servicio: "",
    prioridad: "",
    canal: "",
    zona: "",
    formaPago: "",
    estado: "",
    campania: "",
  });

  // Persistencia (opcional)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pedidos_filters");
      const open = localStorage.getItem("pedidos_filters_open");
      const sq = localStorage.getItem("pedidos_q");
      if (raw) setFilters(JSON.parse(raw));
      if (open) setShowFilters(open === "1");
      if (sq) setQ(sq);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("pedidos_filters", JSON.stringify(filters)); } catch {}
  }, [filters]);
  useEffect(() => {
    try { localStorage.setItem("pedidos_filters_open", showFilters ? "1" : "0"); } catch {}
  }, [showFilters]);
  useEffect(() => {
    try { localStorage.setItem("pedidos_q", q); } catch {}
  }, [q]);

  const options = useMemo(() => ({
    productos: unique(items.map(i => i.producto)),
    subEstados: unique(items.map(i => i.subEstado)),
    servicios: unique(items.map(i => i.servicio)),
    prioridades: unique(items.map(i => i.prioridad)).map(String),
    canales: unique(items.map(i => i.canal)),
    zonas: unique(items.map(i => i.zona)),
    formasPago: unique(items.map(i => i.formaPago)),
    estados: unique(items.map(i => i.estado)),
    campanias: unique(items.map(i => i.campania)),
    moviles: unique(items.map(i => i.movil).map(v => v || "—")),
  }), [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = items.filter((p: Pedido) => {
      // búsqueda libre
      const matchesSearch = !s || [p.nroPedido, p.telefono, p.movil, p.producto, p.estado, p.zona, p.canal]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s));

      // filtros avanzados
      const fd = filters.fechaDesde ? new Date(filters.fechaDesde).getTime() : undefined;
      const fh = filters.fechaHasta ? new Date(filters.fechaHasta).getTime() : undefined;
      const fp = Date.parse(p.fechaPara);
      const matchFecha = (!fd || fp >= fd) && (!fh || fp <= fh);

      const matchTelefono = !filters.telefono || p.telefono.includes(filters.telefono);
      const matchMovil = !filters.movil || (p.movil || "—") === filters.movil;
      const matchProducto = !filters.producto || p.producto === filters.producto;
      const matchSubEstado = !filters.subEstado || p.subEstado === filters.subEstado;
      const matchServicio = !filters.servicio || p.servicio === filters.servicio;
      const matchPrioridad = !filters.prioridad || String(p.prioridad) === filters.prioridad;
      const matchCanal = !filters.canal || p.canal === filters.canal;
      const matchZona = !filters.zona || p.zona === filters.zona;
      const matchForma = !filters.formaPago || p.formaPago === filters.formaPago;
      const matchEstado = !filters.estado || p.estado === filters.estado;
      const matchCamp = !filters.campania || p.campania === filters.campania;

      return matchesSearch && matchFecha && matchTelefono && matchMovil && matchProducto && matchSubEstado && matchServicio && matchPrioridad && matchCanal && matchZona && matchForma && matchEstado && matchCamp;
    });
    return list;
  }, [items, q, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  // chips de filtros activos
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
    subEstado: "",
    servicio: "",
    prioridad: "",
    canal: "",
    zona: "",
    formaPago: "",
    estado: "",
    campania: "",
  });

  return (
    <TableCard
      header={
        <ListHeader
          title="Pedidos"
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
      {/* Zona de filtros avanzada colapsable */}
      {showFilters && (
        <div className="mb-3 rounded-md border border-border/40 p-3 bg-background/50">
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
              <Label className="text-xs text-muted-foreground">SubEstado</Label>
              <Select value={filters.subEstado || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, subEstado: v === ALL ? "" : v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {options.subEstados.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Servicio</Label>
              <Select value={filters.servicio || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, servicio: v === ALL ? "" : v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {options.servicios.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Prioridad</Label>
              <Select value={filters.prioridad || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, prioridad: v === ALL ? "" : v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {options.prioridades.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Canal</Label>
              <Select value={filters.canal || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, canal: v === ALL ? "" : v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {options.canales.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label className="text-xs text-muted-foreground">Forma de Pago</Label>
              <Select value={filters.formaPago || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, formaPago: v === ALL ? "" : v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {options.formasPago.map((o) => (
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
              <Label className="text-xs text-muted-foreground">Campaña</Label>
              <Select value={filters.campania || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, campania: v === ALL ? "" : v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {options.campanias.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-3">
            <Button variant="secondary" size="sm" onClick={clearAll}>Limpiar</Button>
            <Button size="sm" onClick={() => setShowFilters(false)}>Aplicar</Button>
          </div>
        </div>
      )}

      {/* Chips de filtros activos (si hay) */}
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

      {/* Hover info bar above the table (fixed height to avoid layout shift) */}
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
          // keep space reserved so layout doesn't move
          <span className="opacity-0 text-sm">placeholder</span>
        )}
      </div>

      <div className="overflow-x-auto" onMouseLeave={() => setHoverInfo(null)}>
        <Table className="text-sm min-w-[1000px]">
          <TableHeader>
            <TableRow>
              <TableHead>Nro Pedido</TableHead>
              <TableHead>Fecha Para</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Movil</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cant</TableHead>
              <TableHead>SubEstado</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead className="text-right">Atraso</TableHead>
              <TableHead className="text-right">Demora Zona</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Forma de Pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Campaña</TableHead>
              <TableHead className="text-right">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((p) => (
              <TableRow
                key={p.id}
                className="hover:bg-muted/40 cursor-pointer"
                onMouseEnter={() => setHoverInfo({ direccion: p.direccionCompleta, obs: p.observaciones })}
                onClick={() => { setSelected(p); setOpen(true); }}
              >
                <TableCell className="font-medium whitespace-nowrap">{p.nroPedido}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(p.fechaPara).toLocaleString()}</TableCell>
                <TableCell className="whitespace-nowrap">{p.telefono}</TableCell>
                <TableCell className="whitespace-nowrap">{p.movil || "—"}</TableCell>
                <TableCell>{p.producto}</TableCell>
                <TableCell className="text-right">{p.cant}</TableCell>
                <TableCell>{p.subEstado || "—"}</TableCell>
                <TableCell>
                  <Badge className={p.servicio === "Urgente" ? "bg-red-500 text-white" : p.servicio === "Especial" ? "bg-amber-500 text-white" : ""}>
                    {p.servicio || "Normal"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{p.atraso ?? "—"}</TableCell>
                <TableCell className="text-right">{p.demoraZona ?? "—"}</TableCell>
                <TableCell>{String(p.prioridad ?? "—")}</TableCell>
                <TableCell>{p.canal || "—"}</TableCell>
                <TableCell>{p.zona || "—"}</TableCell>
                <TableCell>{p.formaPago || "—"}</TableCell>
                <TableCell>{p.estado}</TableCell>
                <TableCell>{p.campania || "—"}</TableCell>
                <TableCell className="text-right">{p.importe?.toLocaleString() ?? "—"}</TableCell>
              </TableRow>
            ))}
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={17} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Details modal */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelected(null); }}>
        <DialogContent className="p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-3 border-b">
            <DialogTitle className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span>Pedido {selected?.nroPedido}</span>
                {selected?.subEstado && (
                  <Badge variant="secondary" className="text-xs">{selected.subEstado}</Badge>
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
            {/* Left: main info */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-md border p-4 bg-background">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Dirección</div>
                <div className="space-y-1">
                  <div className="text-base font-medium">
                    {mapDireccion || mapNro ? (
                      <>
                        <span>{mapDireccion || "—"}</span>{" "}
                        {mapNro && <span>{mapNro}</span>}
                      </>
                    ) : (
                      selected?.direccionCompleta || "—"
                    )}
                  </div>
                  {(() => {
                    const parts: string[] = [];
                    if (selected?.esquina1 || selected?.esquina2) {
                      parts.push(`Entre ${selected?.esquina1 || "—"} y ${selected?.esquina2 || "—"}`);
                    }
                    const extras = [
                      selected?.block ? `Block ${selected.block}` : "",
                      selected?.apto ? `Apto ${selected.apto}` : "",
                    ].filter(Boolean).join(" · ");
                    if (extras) parts.push(extras);
                    const loc = [mapLocalidad || "", mapDepartamento || ""].filter(Boolean).join(", ");
                    if (loc) parts.push(loc);
                    return parts.length ? (
                      <div className="text-sm text-muted-foreground">{parts.join(" · ")}</div>
                    ) : null;
                  })()}
                </div>
              </div>

              <div className="rounded-md border overflow-hidden">
                <div className="px-4 py-2 border-b bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">Ubicación</div>
                <DynamicMapa
                  departamento={mapDepartamento}
                  localidad={mapLocalidad}
                  direccion={mapDireccion}
                  nroPuerta={mapNro}
                  zonas={[]}
                  mapHeightPx={280}
                />
              </div>

              <div className="rounded-md border p-4 bg-background">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Observaciones</div>
                <div className="text-sm whitespace-pre-line leading-relaxed">{selected?.observaciones || "—"}</div>
              </div>
            </div>

            {/* Right: summary */}
            <div className="space-y-4">
              <div className="rounded-md border p-4 bg-background">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">Detalle</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Producto</div><div className="font-medium">{selected?.producto}</div>
                  <div className="text-muted-foreground">Cantidad</div><div className="font-medium">{selected?.cant}</div>
                  <div className="text-muted-foreground">Servicio</div>
                  <div>
                    <Badge className={selected?.servicio === "Urgente" ? "bg-red-500 text-white" : selected?.servicio === "Especial" ? "bg-amber-500 text-white" : ""}>{selected?.servicio || "Normal"}</Badge>
                  </div>
                  <div className="text-muted-foreground">Forma de pago</div><div className="font-medium">{selected?.formaPago || "—"}</div>
                  <div className="text-muted-foreground">Importe</div><div className="font-medium">{selected?.importe?.toLocaleString() ?? "—"}</div>
                  <div className="text-muted-foreground">Estado</div><div className="font-medium">{selected?.estado || "—"}</div>
                  <div className="text-muted-foreground">SubEstado</div><div className="font-medium">{selected?.subEstado || "—"}</div>
                </div>
              </div>

              <div className="rounded-md border p-4 bg-background">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">Tiempos</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Fecha para</div><div className="font-medium">{selected?.fechaPara ? new Date(selected.fechaPara).toLocaleString() : "—"}</div>
                  <div className="text-muted-foreground">Atraso</div><div className="font-medium">{selected?.atraso ?? "—"}</div>
                  <div className="text-muted-foreground">Demora zona</div><div className="font-medium">{selected?.demoraZona ?? "—"}</div>
                  <div className="text-muted-foreground">Prioridad</div><div className="font-medium">{String(selected?.prioridad ?? "—")}</div>
                </div>
              </div>

              <div className="rounded-md border p-4 bg-background">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">Origen</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Canal</div><div className="font-medium">{selected?.canal || "—"}</div>
                  <div className="text-muted-foreground">Zona</div><div className="font-medium">{selected?.zona || "—"}</div>
                  <div className="text-muted-foreground">Campaña</div><div className="font-medium">{selected?.campania || "—"}</div>
                  <div className="text-muted-foreground">Móvil</div><div className="font-medium">{selected?.movil || "—"}</div>
                  <div className="text-muted-foreground">Teléfono</div><div className="font-medium">{selected?.telefono}</div>
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
