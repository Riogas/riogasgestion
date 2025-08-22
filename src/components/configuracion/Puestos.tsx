"use client";
import React, { useEffect, useState, useMemo } from "react";
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
import { apiGetPuestos, apiABMPuesto } from "@/services/api";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { debounce } from "lodash";
import { Edit, Trash2 } from "lucide-react";
import NuevoPuestoModal from "@/components/configuracion/modals/NuevoPuestoModal";

interface Puesto {
  puestoId: string;
  puestoDsc: string;
  puestoEstado: string;
}

export default function Puestos() {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rawPuestos, setRawPuestos] = useState<any[]>([]);
  const [editingPuesto, setEditingPuesto] = useState<any | null>(null);

  const handleOpenModal = () => {
    setEditingPuesto(null);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const fetchPuestos = async () => {
      try {
        setLoading(true);
        const data = await apiGetPuestos();
        setRawPuestos(Array.isArray(data?.sdtPuestosData) ? data.sdtPuestosData : []);
        
        // Mapear los datos del API al formato esperado
        const mappedData = (data.sdtPuestosData || []).map((puesto: any) => ({
          puestoId: puesto.PuestoId,
          puestoDsc: puesto.PuestoDsc,
          puestoEstado: puesto.PuestoEstado,
        }));
        
        setPuestos(mappedData);
      } catch (error) {
        console.error("Error fetching puestos:", error);
        toast.error("Error al cargar los puestos");
      } finally {
        setLoading(false);
      }
    };

    fetchPuestos();
  }, []);

  const debouncedSearchTerm = useMemo(
    () => debounce((term: string) => term, 100),
    [],
  );

  const filteredData = useMemo(() => {
    return searchTerm.length >= 0
      ? puestos.filter((puesto) =>
          puesto.puestoDsc
            .toLowerCase()
            .includes((debouncedSearchTerm(searchTerm) ?? "").toLowerCase()),
        )
      : puestos;
  }, [searchTerm, puestos]);

  const handleEdit = (puestoId: string) => {
    const seleccionado = rawPuestos.find((p) => String(p.PuestoId) === String(puestoId));
    if (!seleccionado) {
      toast.error("No se encontró el puesto seleccionado");
      return;
    }
    setEditingPuesto(seleccionado);
    setIsModalOpen(true);
  };

  // Crear/Actualizar según corresponda
  const handleUpsertPuesto = async (descripcion: string, estado: string) => {
    try {
      const isEdit = !!editingPuesto?.PuestoId;
      const id = isEdit ? Number(editingPuesto.PuestoId) : 0;
      const modo = isEdit ? "UPD" : "INS";

      // Construir payload completo si estamos editando y el modal ya precargó initialData
      let payload: any = { Modo: modo, PuestoId: id, PuestoDsc: descripcion, PuestoEstado: estado };
      if (isEdit) {
        // Tomamos del registro original todo lo que tengamos disponible
        const p = editingPuesto;
        payload = {
          ...payload,
          PuestoAceptaAgendar: p.PuestoAceptaAgendar,
          PuestoAtraso: p.PuestoAtraso,
          PuestoAutoPedido: p.PuestoAutoPedido,
          PuestoCalDsc: p.PuestoCalDsc,
          PuestoCalId: p.PuestoCalId,
          PuestoCalNombre: p.PuestoCalNombre,
          PuestoCallesId: p.PuestoCallesId,
          PuestoDir: p.PuestoDir,
          PuestoFleteCantidad: p.PuestoFleteCantidad,
          PuestoFleteCobra: p.PuestoFleteCobra,
          PuestoFuerzaAutopedido: p.PuestoFuerzaAutopedido,
          PuestoGCINro: p.PuestoGCINro,
          PuestoGPSEFletera: p.PuestoGPSEFletera,
          PuestoHorarios: p.PuestoHorarios,
          PuestoPalabraAutopedido: p.PuestoPalabraAutopedido,
          PuestoPruebas: p.PuestoPruebas,
          PuestoTelUltLin: p.PuestoTelUltLin,
          PuestoUbicacion: p.PuestoUbicacion,
          PuestoWappActivo: p.PuestoWappActivo,
          PuestoZonDsc: p.PuestoZonDsc,
          PuestoZonId: p.PuestoZonId,
          PuestosCoordX: p.PuestosCoordX,
          PuestosCoordY: p.PuestosCoordY,
          PuestosUltMod: p.PuestosUltMod,
        };
      }

      await apiABMPuesto(payload);
      toast.success(isEdit ? "Puesto actualizado" : "Puesto creado exitosamente");

      // Recargar la lista de puestos
      const data = await apiGetPuestos();
      setRawPuestos(Array.isArray(data?.sdtPuestosData) ? data.sdtPuestosData : []);
      const mappedData = (data.sdtPuestosData || []).map((puesto: any) => ({
        puestoId: puesto.PuestoId,
        puestoDsc: puesto.PuestoDsc,
        puestoEstado: puesto.PuestoEstado,
      }));
      setPuestos(mappedData);
    } catch (error) {
      console.error("Error creando/actualizando puesto:", error);
      toast.error("Error al guardar el puesto");
      throw error; // para que el modal maneje el loading/errores
    }
  };

  const columns = [
    { accessorKey: "puestoId", header: "ID" },
    { accessorKey: "puestoDsc", header: "Descripción" },
    {
      accessorKey: "puestoEstado",
      header: "Estado",
      cell: ({ row }: { row: { original: Puesto } }) => (
        <Badge
          className={
            row.original.puestoEstado === "A"
              ? "bg-green-100 text-green-800 border-green-300"
              : "bg-red-100 text-red-800 border-red-300"
          }
        >
          {row.original.puestoEstado === "A" ? "Activo" : "Pasivo"}
        </Badge>
      ),
    },
    {
      id: "acciones",
      header: "Acciones",
      cell: ({ row }: { row: { original: Puesto } }) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleEdit(row.original.puestoId)}
            className="p-1 hover:bg-gray-100 rounded transition-colors duration-200"
          >
            <Edit className="h-4 w-4 text-blue-600 hover:text-blue-800" />
          </button>
          <button
            onClick={() => handleDelete(row.original.puestoId)}
            className="p-1 hover:bg-gray-100 rounded transition-colors duration-200"
          >
            <Trash2 className="h-4 w-4 text-red-600 hover:text-red-800" />
          </button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">Cargando puestos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center">
        <Button 
          onClick={handleOpenModal}
          className="transition-all duration-200 hover:scale-105 hover:shadow-lg"
        >
          Nuevo
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Input
          placeholder="Buscar por descripción..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No hay puestos disponibles.
                </TableCell>
              </TableRow>
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
          <div className="flex items-center gap-2">
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

      <NuevoPuestoModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingPuesto(null); }}
        onConfirm={handleUpsertPuesto}
        initialData={editingPuesto}
      />
    </div>
  );
}
function handleDelete(puestoId: string): void {
  throw new Error("Function not implemented.");
}

