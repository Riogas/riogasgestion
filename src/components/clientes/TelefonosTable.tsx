"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash, Plus } from "lucide-react";

export type Telefono = {
  id?: string;
  nro: string;
  alias?: string;
  tipo?: string; // movil, fijo, whatsapp, etc.
  estado?: string; // activo/inactivo
};

export function TelefonosTable({ value, onChange }: {
  value: Telefono[];
  onChange: (next: Telefono[]) => void;
}) {
  const [editing, setEditing] = useState<Telefono | null>(null);
  const [open, setOpen] = useState(false);

  const save = () => {
    if (!editing) return;
    if (!editing.nro?.trim()) return;
    if (editing.id) {
      onChange(value.map((t) => (t.id === editing.id ? editing : t)));
    } else {
      onChange([{ ...editing, id: crypto.randomUUID() }, ...value]);
    }
    setOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label>Teléfonos</Label>
        <Button size="sm" variant="outline" onClick={() => { setEditing({ nro: "", alias: "", tipo: "", estado: "Activo" }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Alias</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {value.map((t) => (
            <TableRow key={t.id ?? t.nro}>
              <TableCell>{t.nro}</TableCell>
              <TableCell>{t.alias || "—"}</TableCell>
              <TableCell>{t.tipo || "—"}</TableCell>
              <TableCell>{t.estado || "—"}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onChange(value.filter((x) => (x.id ?? x.nro) !== (t.id ?? t.nro)))}>
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {value.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sin teléfonos</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {open && (
        <div className="rounded-md border p-4 space-y-3 bg-background/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label>Número</Label>
              <Input value={editing?.nro ?? ""} onChange={(e) => setEditing((prev) => ({ ...(prev as Telefono), nro: e.target.value }))} />
            </div>
            <div>
              <Label>Alias</Label>
              <Input value={editing?.alias ?? ""} onChange={(e) => setEditing((prev) => ({ ...(prev as Telefono), alias: e.target.value }))} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={editing?.tipo ?? ""} onValueChange={(v) => setEditing((prev) => ({ ...(prev as Telefono), tipo: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Movil">Móvil</SelectItem>
                  <SelectItem value="Fijo">Fijo</SelectItem>
                  <SelectItem value="Whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={editing?.estado ?? "Activo"} onValueChange={(v) => setEditing((prev) => ({ ...(prev as Telefono), estado: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
