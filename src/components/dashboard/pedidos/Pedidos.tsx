"use client";

import { useMemo, useState, useEffect } from "react";
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
}));

const ALL = "__all__"; // sentinel para "Todos"

function unique<T extends string | number | undefined>(arr: (T | null | undefined)[]) {
  return Array.from(new Set(arr.filter(Boolean) as T[]));
}

export default function Pedidos() {
  const [items] = useState<Pedido[]>(mockPedidos);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const onCreate = () => { /* TODO: Crear Pedido */ };

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

      <div className="overflow-x-auto">
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
              <TableRow key={p.id} className="hover:bg-muted/40">
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
