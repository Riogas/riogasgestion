"use client";

import { useMemo, useState } from "react";
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
};

const mockServicios: Servicio[] = Array.from({ length: 20 }).map((_, i) => ({
  id: String(i + 1),
  nroServicio: String(5000 + i),
  fechaPara: new Date().toISOString(),
  telefono: "099 555 66" + (i % 10),
  movil: i % 2 ? "M-20" + i : "",
  producto: i % 2 ? "Mantenimiento" : "Reparación",
  estado: i % 3 === 0 ? "Pendiente" : i % 3 === 1 ? "En curso" : "Cerrado",
  defecto: i % 2 ? "Perdida en flexible" : "No enciende",
  zona: "Z" + (i % 4),
  atraso: i * 3,
  observaciones: i % 2 ? "Cliente no atiende" : "Coordinar franja horaria",
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

      <div className="overflow-x-auto">
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
              <TableRow key={p.id} className="hover:bg-muted/40">
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
