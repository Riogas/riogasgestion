"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Pencil,
  Trash,
  Plus,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

const mockClients = [
  {
    id: 1,
    name: "Julio Gómez",
    address: "Montevideo, Uruguay",
    phone: "099 123 456",
    status: "activo",
  },
  {
    id: 2,
    name: "Laura Pérez",
    address: "Canelones, Uruguay",
    phone: "092 555 888",
    status: "pasivo",
  },
  {
    id: 3,
    name: "Carlos Rodríguez",
    address: "Maldonado, Uruguay",
    phone: "098 111 222",
    status: "activo",
  },
  {
    id: 4,
    name: "Ana Silva",
    address: "Colonia, Uruguay",
    phone: "094 222 333",
    status: "activo",
  },
  {
    id: 5,
    name: "Mario López",
    address: "Florida, Uruguay",
    phone: "097 444 555",
    status: "pasivo",
  },
  {
    id: 6,
    name: "Lucía Núñez",
    address: "Durazno, Uruguay",
    phone: "093 666 777",
    status: "activo",
  },
];

export default function ClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState(mockClients);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const s = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.address.toLowerCase().includes(s) ||
        c.phone.toLowerCase().includes(s)
    );
  }, [search, clients]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const goFirst = () => setPage(1);
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const goLast = () => setPage(totalPages);

  return (
    <div className="p-4">
      <Card className="p-6 space-y-6">
        {/* Header título + botón */}
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold">Administración de Clientes</h1>
          <Button
            onClick={() => router.push("/dashboard/clientes/nuevo")}
            className="shrink-0"
          >
            Nuevo
          </Button>
        </div>

        {/* Búsqueda */}
        <div>
          <Input
            placeholder="Buscar por nombre, teléfono o dirección..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-md"
          />
        </div>

        {/* Tabla */}
        <div className="rounded-md border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-44">Nombre</TableHead>
                  <TableHead className="min-w-[220px]">Dirección</TableHead>
                  <TableHead className="w-40">Teléfono</TableHead>
                  <TableHead className="w-28">Estado</TableHead>
                  <TableHead className="text-right pr-6 w-32">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((client) => (
                  <TableRow
                    key={client.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <TableCell className="font-medium whitespace-nowrap">
                      {client.name}
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      {client.address}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {client.phone}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          client.status === "activo" ? "secondary" : "destructive"
                        }
                        className={
                          client.status === "pasivo" ? "opacity-70" : ""
                        }
                      >
                        {client.status === "activo" ? "Activo" : "Pasivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2 pr-6">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Eliminar"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-10 text-muted-foreground"
                    >
                      Sin resultados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pie tabla: paginación */}
          <div className="flex flex-col sm:flex-row items-center gap-4 px-4 py-3 border-t text-sm bg-background/40">
            {/* Registros por página */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-muted-foreground">Registros por página</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info de página */}
            <div className="flex-1 text-center text-muted-foreground order-3 sm:order-none w-full sm:w-auto">
              Página {page} de {totalPages}
            </div>

            {/* Navegación */}
            <div className="flex items-center gap-2 ml-auto">
              {/** Clases unificadas para look blanco */}
              {(() => {
                const base =
                  "h-8 w-8 size-8 bg-white text-foreground dark:text-gray-900 border border-border shadow-sm hover:bg-white/90 disabled:opacity-50 disabled:pointer-events-none transition";
                return (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={base}
                      onClick={goFirst}
                      disabled={page === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={base}
                      onClick={goPrev}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={base}
                      onClick={goNext}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={base}
                      onClick={goLast}
                      disabled={page === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
