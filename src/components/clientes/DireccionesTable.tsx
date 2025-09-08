"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash } from "lucide-react";

export type DireccionRow = {
  id?: string;
  calle?: string;
  nro?: string;
  esquina1?: string;
  esquina2?: string;
  nivel?: string;
  local?: string;
  zona?: string;
  lat?: string;
  lng?: string;
};

export function DireccionesTable({ value, onEdit, onDelete, onNew }: {
  value: DireccionRow[];
  onEdit: (id?: string) => void;
  onDelete: (id?: string) => void;
  onNew: () => void;
}) {
  return (
    <div>
      {/* Header removed to avoid duplication; parent card renders title and actions */}
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="h-8">
            <TableHead className="py-1.5 px-2">Calle</TableHead>
            <TableHead className="w-20 py-1.5 px-2">N°</TableHead>
            <TableHead className="text-right w-24 py-1.5 px-2">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {value.map((d) => (
            <TableRow key={d.id ?? `${d.calle}-${d.nro}`} className="h-8">
              <TableCell className="truncate max-w-[280px] py-1 px-2" title={d.calle}>{d.calle}</TableCell>
              <TableCell className="whitespace-nowrap py-1 px-2">{d.nro}</TableCell>
              <TableCell className="text-right py-1 px-2">
                <div className="inline-flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(d.id)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(d.id)}><Trash className="w-4 h-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {value.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-3 text-muted-foreground">Sin direcciones</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
