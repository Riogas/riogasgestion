"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Tipos
interface Fletera {
  FleteraId: number;
  FleteraNombre: string;
  FleteraEstado: string;
}

export default function Fleteras() {
  const [fleteras, setFleteras] = useState<Fletera[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // TODO: Reemplazar con llamada a API real
  const fetchFleteras = async () => {
    setLoading(true);
    try {
      // const res = await apiGetFleteras();
      // setFleteras(res.sdtFleteras || []);
      // toast.success("Fleteras cargadas correctamente");
      setFleteras([]); // Placeholder hasta conectar la API
    } catch {
      toast.error("Error al cargar fleteras");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleteras();
  }, []);

  // Filtrado por texto de búsqueda
  const filteredData = useMemo(() => {
    if (!searchText.trim()) return fleteras;
    const lower = searchText.toLowerCase();
    return fleteras.filter(
      (f) =>
        f.FleteraId.toString().includes(lower) ||
        f.FleteraNombre.toLowerCase().includes(lower)
    );
  }, [fleteras, searchText]);

  const columns = [
    {
      accessorKey: "FleteraId",
      header: "Identificador",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorKey: "FleteraNombre",
      header: "Nombre",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorKey: "FleteraEstado",
      header: "Estado",
      cell: ({ row }: any) => {
        const estado = row.original.FleteraEstado;

        return (
          <Badge
            className={`${estado === "S" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}
          >
            {estado === "S" ? "Activo" : "Pasivo"}
          </Badge>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Input
          placeholder="Buscar fleteras..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-1/2 bg-gray-700 text-white"
        />
        <Button
          onClick={() => {
            // TODO: Abrir modal de nueva fletera
            toast.info("Funcionalidad de nueva fletera próximamente");
          }}
        >
          + Nuevo
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  {loading ? "Cargando..." : "No se encontraron fleteras"}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex justify-between items-center mt-2 p-2">
          <div className="flex items-center gap-2">
            <span>Registros por página</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="border rounded px-2 py-1 bg-secondary"
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <span>
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </span>
          <div className="flex gap-2">
            <Button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              «
            </Button>
            <Button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              ‹
            </Button>
            <Button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              ›
            </Button>
            <Button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              »
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
