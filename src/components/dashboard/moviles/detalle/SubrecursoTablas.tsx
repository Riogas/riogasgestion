"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, PackageOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMovilMutations, useMovilCatalogos } from "@/hooks/moviles";
import type {
  MovilDetalle,
  ProductoPayload,
  PuntoPayload,
  EscenarioPayload,
} from "@/lib/types/movil";

type Mutations = ReturnType<typeof useMovilMutations>;

// ─── Sección 4: Recarga y productos (movil_stock) ───────────────────────────────

export function ProductosTabla({
  movil,
  mut,
}: {
  movil: MovilDetalle;
  mut: Mutations;
}) {
  const empty: ProductoPayload = {
    productoEmpresa: "",
    productoCodigo: "",
    stockMin: null,
    stockDps: null,
    tiempoCarga: null,
    tiempoDescarga: null,
  };
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductoPayload>(empty);

  const abrirNuevo = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };
  const abrirEditar = (p: MovilDetalle["productos"][number]) => {
    setEditId(p.id);
    setForm({
      productoEmpresa: p.productoEmpresa ?? "",
      productoCodigo: p.productoCodigo ?? "",
      stockMin: p.stockMin,
      stockDps: p.stockDps,
      tiempoCarga: p.tiempoCarga,
      tiempoDescarga: p.tiempoDescarga,
    });
    setOpen(true);
  };

  const guardar = () => {
    const onDone = () => {
      toast.success(editId ? "Producto actualizado" : "Producto agregado");
      setOpen(false);
    };
    const onErr = () => toast.error("Error al guardar el producto");
    if (editId) {
      mut.productoUpdate.mutate({ subId: editId, dto: form }, { onSuccess: onDone, onError: onErr });
    } else {
      mut.productoAdd.mutate(form, { onSuccess: onDone, onError: onErr });
    }
  };

  const eliminar = (id: number) => {
    mut.productoRemove.mutate(id, {
      onSuccess: () => toast.success("Producto eliminado"),
      onError: () => toast.error("Error al eliminar"),
    });
  };

  return (
    <Card className="gap-4 px-5">
      <TablaHeader
        titulo="Recarga y productos"
        subtitulo="Stock y tiempos de carga/descarga por producto."
        onAdd={abrirNuevo}
      />
      {movil.productos.length === 0 ? (
        <EmptyVacio texto="Sin productos cargados para este móvil." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa/Prod</TableHead>
                <TableHead>Cod.Prod</TableHead>
                <TableHead className="text-right">Stock min</TableHead>
                <TableHead className="text-right">Stock dps</TableHead>
                <TableHead className="text-right">T.carga</TableHead>
                <TableHead className="text-right">T.descarga</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movil.productos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.productoEmpresa || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.productoCodigo || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.stockMin ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.stockDps ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.tiempoCarga ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.tiempoDescarga ?? "—"}</TableCell>
                  <AccionesCell onEdit={() => abrirEditar(p)} onDelete={() => eliminar(p.id)} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <DialogInput label="Empresa/Prod" value={form.productoEmpresa ?? ""} onChange={(v) => setForm((f) => ({ ...f, productoEmpresa: v }))} />
            <DialogInput label="Cod.Prod" value={form.productoCodigo ?? ""} onChange={(v) => setForm((f) => ({ ...f, productoCodigo: v }))} />
            <DialogInput label="Stock min" type="number" value={numStr(form.stockMin)} onChange={(v) => setForm((f) => ({ ...f, stockMin: toNum(v) }))} />
            <DialogInput label="Stock dps" type="number" value={numStr(form.stockDps)} onChange={(v) => setForm((f) => ({ ...f, stockDps: toNum(v) }))} />
            <DialogInput label="T.carga" type="number" value={numStr(form.tiempoCarga)} onChange={(v) => setForm((f) => ({ ...f, tiempoCarga: toNum(v) }))} />
            <DialogInput label="T.descarga" type="number" value={numStr(form.tiempoDescarga)} onChange={(v) => setForm((f) => ({ ...f, tiempoDescarga: toNum(v) }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={mut.productoAdd.isPending || mut.productoUpdate.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Sección 5: Ptos de recarga (movil_punto_recarga) ───────────────────────────

export function PuntosTabla({ movil, mut }: { movil: MovilDetalle; mut: Mutations }) {
  const empty: PuntoPayload = { nombre: "", puntoId: null };
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PuntoPayload>(empty);

  const abrirNuevo = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };
  const abrirEditar = (p: MovilDetalle["puntosRecarga"][number]) => {
    setEditId(p.id);
    setForm({ nombre: p.nombre ?? "", puntoId: p.puntoId });
    setOpen(true);
  };

  const guardar = () => {
    const onDone = () => {
      toast.success(editId ? "Punto actualizado" : "Punto agregado");
      setOpen(false);
    };
    const onErr = () => toast.error("Error al guardar el punto");
    if (editId) {
      mut.puntoUpdate.mutate({ subId: editId, dto: form }, { onSuccess: onDone, onError: onErr });
    } else {
      mut.puntoAdd.mutate(form, { onSuccess: onDone, onError: onErr });
    }
  };

  const eliminar = (id: number) => {
    mut.puntoRemove.mutate(id, {
      onSuccess: () => toast.success("Punto eliminado"),
      onError: () => toast.error("Error al eliminar"),
    });
  };

  return (
    <Card className="gap-4 px-5">
      <TablaHeader titulo="Ptos de recarga" subtitulo="Puntos de recarga habilitados." onAdd={abrirNuevo} />
      {movil.puntosRecarga.length === 0 ? (
        <EmptyVacio texto="Sin puntos de recarga cargados." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Id</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movil.puntosRecarga.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="tabular-nums">{p.puntoId ?? "—"}</TableCell>
                <TableCell>{p.nombre || "—"}</TableCell>
                <AccionesCell onEdit={() => abrirEditar(p)} onDelete={() => eliminar(p.id)} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar punto" : "Nuevo punto"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <DialogInput label="Id (V_PTOSRECARGA)" type="number" value={numStr(form.puntoId)} onChange={(v) => setForm((f) => ({ ...f, puntoId: toNum(v) }))} />
            <DialogInput label="Nombre" value={form.nombre ?? ""} onChange={(v) => setForm((f) => ({ ...f, nombre: v }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={mut.puntoAdd.isPending || mut.puntoUpdate.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Sección 6: Servicios habilitados (movil_servicio) ──────────────────────────

export function ServiciosTabla({ movil, mut }: { movil: MovilDetalle; mut: Mutations }) {
  const { data: catalogos } = useMovilCatalogos();
  const [open, setOpen] = useState(false);
  const [servicioId, setServicioId] = useState<string>("");

  const guardar = () => {
    if (!servicioId) {
      toast.error("Seleccioná un servicio");
      return;
    }
    mut.servicioAdd.mutate(
      { servicioId: Number(servicioId) },
      {
        onSuccess: () => {
          toast.success("Servicio agregado");
          setOpen(false);
          setServicioId("");
        },
        onError: () => toast.error("Error al agregar"),
      },
    );
  };

  const eliminar = (id: number) => {
    mut.servicioRemove.mutate(id, {
      onSuccess: () => toast.success("Servicio eliminado"),
      onError: () => toast.error("Error al eliminar"),
    });
  };

  return (
    <Card className="gap-4 px-5">
      <TablaHeader titulo="Servicios habilitados" subtitulo="Servicios que puede operar el móvil." onAdd={() => setOpen(true)} />
      {movil.servicios.length === 0 ? (
        <EmptyVacio texto="Sin servicios habilitados." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Servicio</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movil.servicios.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="tabular-nums">{s.servicioId ?? "—"}</TableCell>
                <TableCell>{s.nombre || "—"}</TableCell>
                <AccionesCell onDelete={() => eliminar(s.id)} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar servicio</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Servicio</label>
            <select
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
              className="h-10 w-full rounded-[var(--radius-md)] border-[1.5px] border-input bg-card px-3 text-sm"
            >
              <option value="">Seleccionar…</option>
              {(catalogos?.servicios ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre ?? `#${s.id}`}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={mut.servicioAdd.isPending}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Sección 7: Escenarios y prioridad (movil_zona) ─────────────────────────────

export function EscenariosTabla({ movil, mut }: { movil: MovilDetalle; mut: Mutations }) {
  const empty: EscenarioPayload = { escenarioId: null, canalId: null, zonaId: null, tipo: null };
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EscenarioPayload>(empty);

  const abrirNuevo = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };
  const abrirEditar = (z: MovilDetalle["escenarios"][number]) => {
    setEditId(z.id);
    setForm({ escenarioId: z.escenarioId, canalId: z.canalId, zonaId: z.zonaId, tipo: z.tipo });
    setOpen(true);
  };

  const guardar = () => {
    const onDone = () => {
      toast.success(editId ? "Escenario actualizado" : "Escenario agregado");
      setOpen(false);
    };
    const onErr = () => toast.error("Error al guardar el escenario");
    if (editId) {
      mut.escenarioUpdate.mutate({ subId: editId, dto: form }, { onSuccess: onDone, onError: onErr });
    } else {
      mut.escenarioAdd.mutate(form, { onSuccess: onDone, onError: onErr });
    }
  };

  const eliminar = (id: number) => {
    mut.escenarioRemove.mutate(id, {
      onSuccess: () => toast.success("Escenario eliminado"),
      onError: () => toast.error("Error al eliminar"),
    });
  };

  return (
    <Card className="gap-4 px-5">
      <TablaHeader titulo="Escenarios y prioridad" subtitulo="Asignación de escenarios, canales y zonas." onAdd={abrirNuevo} />
      {movil.escenarios.length === 0 ? (
        <EmptyVacio texto="Sin escenarios asignados." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Escenario</TableHead>
                <TableHead className="text-right">Canal</TableHead>
                <TableHead className="text-right">Zona</TableHead>
                <TableHead className="text-right">Prioridad/Tránsito</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movil.escenarios.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="text-right tabular-nums">{z.escenarioId ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{z.canalId ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{z.zonaId ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{z.tipo ?? "—"}</TableCell>
                  <AccionesCell onEdit={() => abrirEditar(z)} onDelete={() => eliminar(z.id)} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar escenario" : "Nuevo escenario"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <DialogInput label="Escenario" type="number" value={numStr(form.escenarioId)} onChange={(v) => setForm((f) => ({ ...f, escenarioId: toNum(v) }))} />
            <DialogInput label="Canal" type="number" value={numStr(form.canalId)} onChange={(v) => setForm((f) => ({ ...f, canalId: toNum(v) }))} />
            <DialogInput label="Zona" type="number" value={numStr(form.zonaId)} onChange={(v) => setForm((f) => ({ ...f, zonaId: toNum(v) }))} />
            <DialogInput label="Tipo (prioridad/tránsito)" type="number" value={numStr(form.tipo)} onChange={(v) => setForm((f) => ({ ...f, tipo: toNum(v) }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={mut.escenarioAdd.isPending || mut.escenarioUpdate.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Helpers compartidos ────────────────────────────────────────────────────────

function TablaHeader({
  titulo,
  subtitulo,
  onAdd,
}: {
  titulo: string;
  subtitulo: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
      </div>
      <Button size="sm" variant="secondary" onClick={onAdd}>
        <Plus className="size-4" />
        Agregar
      </Button>
    </div>
  );
}

function AccionesCell({ onEdit, onDelete }: { onEdit?: () => void; onDelete: () => void }) {
  return (
    <TableCell className="text-right">
      <div className="inline-flex">
        {onEdit && (
          <Button variant="ghost" size="icon" className="size-8" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </TableCell>
  );
}

function EmptyVacio({ texto }: { texto: string }) {
  return <EmptyState icon={PackageOpen} size="sm" title="Sin datos" description={texto} />;
}

function DialogInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function numStr(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

function toNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
