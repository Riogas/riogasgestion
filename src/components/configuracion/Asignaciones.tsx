"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import AsignacionMovilesModal, {
  type Movil,
  type Zona,
  type AsignacionesState,
} from "./AsignacionMovilesModal";

// Tipos
interface Asignacion {
  AsignacionId: number;
  Movil: string;
  Zona: string;
  TipoServicio: string;
  Turno: string;
}

export default function Asignaciones() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [modalOpen, setModalOpen] = useState(false);

  // TODO: Reemplazar con datos reales de la API
  const mockMoviles: Movil[] = [
    { id: "1", nombre: "Móvil 01" },
    { id: "2", nombre: "Móvil 02" },
    { id: "3", nombre: "Móvil 03" },
    { id: "4", nombre: "Móvil 04" },
    { id: "5", nombre: "Móvil 05" },
    { id: "6", nombre: "Móvil 06" },
    { id: "7", nombre: "Móvil 07" },
    { id: "8", nombre: "Móvil 08" },
    { id: "9", nombre: "Móvil 09" },
    { id: "10", nombre: "Móvil 10" },
  ];

  const mockZonas: Zona[] = [
    { id: "z1", nombre: "Zona Norte", color: "#1976d2" },
    { id: "z2", nombre: "Zona Sur", color: "#388e3c" },
    { id: "z3", nombre: "Zona Este", color: "#d32f2f" },
    { id: "z4", nombre: "Zona Oeste", color: "#ff9800" },
    { id: "z5", nombre: "Zona Centro", color: "#7b1fa2" },
  ];

  const tiposServicio = ["Urgente", "Nocturno"];

  // Estado inicial del modal (vacío por ahora, TODO: cargar desde API)
  const [modalAsignaciones] = useState<AsignacionesState>({});

  // TODO: Reemplazar con llamada a API real
  const fetchAsignaciones = async () => {
    setLoading(true);
    try {
      // const res = await apiGetAsignaciones();
      // setAsignaciones(res.sdtAsignaciones || []);
      // toast.success("Asignaciones cargadas correctamente");
      setAsignaciones([]); // Placeholder hasta conectar la API
    } catch {
      toast.error("Error al cargar asignaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAsignaciones();
  }, []);

  // Filtrado por texto de búsqueda
  const filteredData = useMemo(() => {
    if (!searchText.trim()) return asignaciones;
    const lower = searchText.toLowerCase();
    return asignaciones.filter(
      (a) =>
        a.Movil.toLowerCase().includes(lower) ||
        a.Zona.toLowerCase().includes(lower) ||
        a.TipoServicio.toLowerCase().includes(lower) ||
        a.Turno.toLowerCase().includes(lower)
    );
  }, [asignaciones, searchText]);

  const columns = [
    {
      accessorKey: "Movil",
      header: "Móvil",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorKey: "Zona",
      header: "Zona",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorKey: "TipoServicio",
      header: "Tipo Servicio",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorKey: "Turno",
      header: "Turno",
      cell: (info: any) => info.getValue(),
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
          placeholder="Buscar asignaciones..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-1/2 bg-gray-700 text-white"
        />
        <Button
          onClick={() => setModalOpen(true)}
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
                  {loading ? "Cargando..." : "No se encontraron asignaciones"}
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

      {/* Modal de asignación visual */}
      <AsignacionMovilesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        moviles={mockMoviles}
        zonas={mockZonas}
        tiposServicio={tiposServicio}
        asignaciones={modalAsignaciones}
        onSave={(nuevasAsignaciones: AsignacionesState) => {
          // TODO: Enviar a API real
          console.log("Asignaciones guardadas:", nuevasAsignaciones);
          toast.success("Asignaciones actualizadas correctamente");
          setModalOpen(false);
        }}
      />
    </div>
  );
}
