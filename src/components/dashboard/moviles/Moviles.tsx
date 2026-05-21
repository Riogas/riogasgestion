"use client";

import { useMemo, useState, useEffect } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Truck, CheckCircle2, Wrench, Pause, Package } from "lucide-react";
import { ListHeader } from "@/components/abm/ListHeader";
import { TableCard } from "@/components/abm/TableCard";
import { Pager } from "@/components/abm/Pager";
import { PageStats, type PageStatItem } from "@/components/ui/PageStats";

// Tipo de Movil
export type Movil = {
  id: string; // identificador interno
  movil: string; // número del móvil (identificador del vehículo)
  estado: "Activo" | "Inactivo" | "Mantenimiento" | string;
  cantPend: number;
  loteMax: number; // máximos pedidos simultáneos
  servicio: "Normal" | "Urgente" | "Especial" | string;
  telefono?: string;
  bajaMomentanea: boolean;
  observaciones?: string;
};

const mockMoviles: Movil[] = [
  { id: "1", movil: "M-101", estado: "Activo", cantPend: 3, loteMax: 5, servicio: "Normal", telefono: "099 123 456", bajaMomentanea: false, observaciones: "—" },
  { id: "2", movil: "M-202", estado: "Mantenimiento", cantPend: 0, loteMax: 4, servicio: "Especial", telefono: "098 555 222", bajaMomentanea: true, observaciones: "Cambio de pastillas" },
  { id: "3", movil: "M-303", estado: "Activo", cantPend: 1, loteMax: 6, servicio: "Urgente", telefono: "097 000 111", bajaMomentanea: false, observaciones: "—" },
];

export default function Moviles() {
  const [items, setItems] = useState<Movil[]>(mockMoviles);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Modal create/edit
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Movil | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) =>
      [m.movil, m.estado, m.servicio, m.telefono, m.observaciones]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  // Stats contextuales
  const stats: PageStatItem[] = useMemo(() => {
    const total = items.length;
    const activos = items.filter((m) => m.estado === "Activo").length;
    const mantenimiento = items.filter((m) => m.estado === "Mantenimiento").length;
    const baja = items.filter((m) => m.bajaMomentanea).length;
    const pendientes = items.reduce((s, m) => s + (m.cantPend || 0), 0);
    return [
      { id: "total", label: "Total flota",     value: String(total),         icon: Truck,           variant: "primary" },
      { id: "act",   label: "Activos",         value: String(activos),       icon: CheckCircle2,    variant: "success" },
      { id: "mant",  label: "Mantenimiento",   value: String(mantenimiento), icon: Wrench,          variant: "warn" },
      { id: "baja",  label: "Baja momentánea", value: String(baja),          icon: Pause,           variant: "destructive" },
      { id: "pend",  label: "Pedidos pendientes", value: String(pendientes), icon: Package,         variant: "primary" },
    ];
  }, [items]);

  const openCreate = () => { setEditing(null); setOpenModal(true); };
  const openEdit = (m: Movil) => { setEditing(m); setOpenModal(true); };

  const handleDelete = (id: string) => {
    if (!confirm("¿Eliminar este móvil?")) return;
    // TODO: llamar API DELETE
    setItems((prev) => prev.filter((m) => m.id !== id));
  };

  // Guardar desde el modal
  const onSave = (data: Omit<Movil, "id"> & { id?: string }) => {
    if (data.id) {
      // update
      setItems((prev) => prev.map((m) => (m.id === data.id ? { ...(m as Movil), ...(data as any) } : m)));
    } else {
      // create
      const id = crypto.randomUUID();
      setItems((prev) => [{ id, ...data } as Movil, ...prev]);
    }
    setOpenModal(false);
  };

  return (
    <>
    <PageStats items={stats} />
    <TableCard
      header={
        <ListHeader
          title="Móviles"
          search={query}
          onSearch={(v) => { setQuery(v); setPage(1); }}
          onCreate={openCreate}
          createLabel="Nuevo"
        />
      }
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Movil</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Cant Pend</TableHead>
              <TableHead className="text-right">Lote</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Baja momentánea</TableHead>
              <TableHead>Observaciones</TableHead>
              <TableHead className="w-[120px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((m) => (
              <TableRow key={m.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">{m.movil}</TableCell>
                <TableCell>
                  <Badge variant={m.estado === "Activo" ? "default" : "secondary"}>{m.estado}</Badge>
                </TableCell>
                <TableCell className="text-right">{m.cantPend}</TableCell>
                <TableCell className="text-right">{m.loteMax}</TableCell>
                <TableCell>
                  <Badge className={m.servicio === "Urgente" ? "bg-red-500 text-white" : m.servicio === "Especial" ? "bg-amber-500 text-white" : ""}>
                    {m.servicio}
                  </Badge>
                </TableCell>
                <TableCell>{m.telefono || "—"}</TableCell>
                <TableCell>
                  {m.bajaMomentanea ? (
                    <Badge variant="destructive">Sí</Badge>
                  ) : (
                    <Badge variant="outline">No</Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-[280px] truncate" title={m.observaciones || ""}>
                  {m.observaciones || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Sin resultados
                </TableCell>
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

      <MovilModal
        open={openModal}
        onOpenChange={setOpenModal}
        initial={editing || undefined}
        onSave={onSave}
      />
    </TableCard>
    </>
  );
}

function MovilModal({ open, onOpenChange, initial, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Movil;
  onSave: (data: Omit<Movil, "id"> & { id?: string }) => void;
}) {
  const [movil, setMovil] = useState(initial?.movil || "");
  const [estado, setEstado] = useState<Movil["estado"]>(initial?.estado || "Activo");
  const [cantPend, setCantPend] = useState(initial?.cantPend ?? 0);
  const [loteMax, setLoteMax] = useState(initial?.loteMax ?? 1);
  const [servicio, setServicio] = useState<Movil["servicio"]>(initial?.servicio || "Normal");
  const [telefono, setTelefono] = useState(initial?.telefono || "");
  const [bajaMomentanea, setBajaMomentanea] = useState(initial?.bajaMomentanea ?? false);
  const [observaciones, setObservaciones] = useState(initial?.observaciones || "");

  // Sync al abrir con initial
  useEffect(() => {
    setMovil(initial?.movil || "");
    setEstado(initial?.estado || "Activo");
    setCantPend(initial?.cantPend ?? 0);
    setLoteMax(initial?.loteMax ?? 1);
    setServicio(initial?.servicio || "Normal");
    setTelefono(initial?.telefono || "");
    setBajaMomentanea(initial?.bajaMomentanea ?? false);
    setObservaciones(initial?.observaciones || "");
  }, [initial, open]);

  const handleSave = () => {
    if (!movil.trim()) return;
    onSave({
      id: initial?.id,
      movil: movil.trim(),
      estado,
      cantPend: Number(cantPend) || 0,
      loteMax: Number(loteMax) || 1,
      servicio,
      telefono: telefono.trim(),
      bajaMomentanea,
      observaciones: observaciones.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar móvil" : "Nuevo móvil"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label>Movil</Label>
            <Input value={movil} onChange={(e) => setMovil(e.target.value)} placeholder="Ej: M-404" />
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {(["Activo", "Inactivo", "Mantenimiento"] as const).map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cant Pend</Label>
            <Input type="number" value={cantPend} onChange={(e) => setCantPend(Number(e.target.value))} min={0} />
          </div>
          <div>
            <Label>Lote (máx simultáneo)</Label>
            <Input type="number" value={loteMax} onChange={(e) => setLoteMax(Number(e.target.value))} min={1} />
          </div>
          <div>
            <Label>Servicio</Label>
            <Select value={servicio} onValueChange={(v) => setServicio(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Servicio" />
              </SelectTrigger>
              <SelectContent>
                {(["Normal", "Urgente", "Especial"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="099 000 000" />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={bajaMomentanea} onCheckedChange={setBajaMomentanea} id="baja" />
            <Label htmlFor="baja">Baja momentánea</Label>
          </div>
          <div className="sm:col-span-2">
            <Label>Observaciones</Label>
            <textarea
              value={observaciones}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>{initial ? "Guardar" : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
