"use client";
import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";
import { toast } from "sonner";

// ── Tipos ──
export interface Movil {
  id: string;
  nombre: string;
}

export interface Zona {
  id: string;
  nombre: string;
  color?: string;
}

export interface Asignacion {
  movilId: string;
  zonaId: string;
  tipoServicio: string;
  turno: string;
}

interface AsignacionMovilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  moviles: Movil[];
  zonas: Zona[];
  asignaciones: Asignacion[];
  onSave: (asignaciones: Asignacion[]) => void;
}

const TIPOS_SERVICIO = ["Distribución", "Mantenimiento", "Emergencia", "Instalación"];
const TURNOS = ["Mañana", "Tarde", "Noche"];

const ZONE_COLORS = [
  "#1976d2", "#388e3c", "#d32f2f", "#ff9800", "#7b1fa2",
  "#00796b", "#c2185b", "#5d4037", "#455a64", "#f57f17",
];

function getZoneColor(zona: Zona, index: number) {
  return zona.color || ZONE_COLORS[index % ZONE_COLORS.length];
}

export default function AsignacionMovilesModal({
  isOpen,
  onClose,
  moviles,
  zonas,
  asignaciones: initialAsignaciones,
  onSave,
}: AsignacionMovilesModalProps) {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>(initialAsignaciones);
  const [selectedZona, setSelectedZona] = useState<string | null>(
    zonas.length > 0 ? zonas[0].id : null
  );
  const [searchMovil, setSearchMovil] = useState("");
  const [tipoServicioFilter, setTipoServicioFilter] = useState<string>("__todos__");
  const [turnoFilter, setTurnoFilter] = useState<string>("__todos__");

  // Reset al abrir
  React.useEffect(() => {
    if (isOpen) {
      setAsignaciones(initialAsignaciones);
      setSelectedZona(zonas.length > 0 ? zonas[0].id : null);
      setSearchMovil("");
      setTipoServicioFilter("__todos__");
      setTurnoFilter("__todos__");
    }
  }, [isOpen, initialAsignaciones, zonas]);

  // Asignaciones de la zona seleccionada
  const zonalAsignaciones = useMemo(
    () => asignaciones.filter((a) => a.zonaId === selectedZona),
    [asignaciones, selectedZona]
  );

  // IDs de móviles asignados a la zona seleccionada
  const assignedMovilIds = useMemo(
    () => new Set(zonalAsignaciones.map((a) => a.movilId)),
    [zonalAsignaciones]
  );

  // Móviles filtrados por búsqueda
  const filteredMoviles = useMemo(() => {
    if (!searchMovil.trim()) return moviles;
    const lower = searchMovil.toLowerCase();
    return moviles.filter((m) => m.nombre.toLowerCase().includes(lower));
  }, [moviles, searchMovil]);

  // Contar asignaciones por zona
  const countByZona = useMemo(() => {
    const counts: Record<string, number> = {};
    asignaciones.forEach((a) => {
      counts[a.zonaId] = (counts[a.zonaId] || 0) + 1;
    });
    return counts;
  }, [asignaciones]);

  // Toggle asignación de un móvil a la zona seleccionada
  const toggleMovil = (movilId: string) => {
    if (!selectedZona) return;

    if (assignedMovilIds.has(movilId)) {
      // Remover asignación
      setAsignaciones((prev) =>
        prev.filter((a) => !(a.movilId === movilId && a.zonaId === selectedZona))
      );
    } else {
      // Agregar asignación con valores por defecto
      setAsignaciones((prev) => [
        ...prev,
        {
          movilId,
          zonaId: selectedZona,
          tipoServicio: "Distribución",
          turno: "Mañana",
        },
      ]);
    }
  };

  // Actualizar tipo servicio de una asignación
  const updateTipoServicio = (movilId: string, tipoServicio: string) => {
    if (!selectedZona) return;
    setAsignaciones((prev) =>
      prev.map((a) =>
        a.movilId === movilId && a.zonaId === selectedZona
          ? { ...a, tipoServicio }
          : a
      )
    );
  };

  // Actualizar turno de una asignación
  const updateTurno = (movilId: string, turno: string) => {
    if (!selectedZona) return;
    setAsignaciones((prev) =>
      prev.map((a) =>
        a.movilId === movilId && a.zonaId === selectedZona
          ? { ...a, turno }
          : a
      )
    );
  };

  // Obtener asignación de un móvil en la zona seleccionada
  const getAsignacion = (movilId: string) =>
    zonalAsignaciones.find((a) => a.movilId === movilId);

  // Zonas donde está asignado un móvil (para mostrar indicadores)
  const getMovilZonas = (movilId: string) =>
    asignaciones
      .filter((a) => a.movilId === movilId)
      .map((a) => zonas.find((z) => z.id === a.zonaId))
      .filter(Boolean) as Zona[];

  const handleSave = () => {
    onSave(asignaciones);
    toast.success("Asignaciones guardadas correctamente");
    onClose();
  };

  const selectedZonaData = zonas.find((z) => z.id === selectedZona);
  const selectedZonaColor = selectedZonaData
    ? getZoneColor(selectedZonaData, zonas.indexOf(selectedZonaData))
    : "#1976d2";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-300 max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl">Asignación de Móviles a Zonas</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Seleccioná una zona y asigná los móviles. Cada móvil puede estar en varias zonas.
          </p>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* ── Panel izquierdo: Zonas ── */}
          <div className="w-70 border-r bg-muted/30 flex flex-col">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Zonas
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {zonas.map((zona, idx) => {
                const color = getZoneColor(zona, idx);
                const count = countByZona[zona.id] || 0;
                const isSelected = selectedZona === zona.id;

                return (
                  <button
                    key={zona.id}
                    onClick={() => setSelectedZona(zona.id)}
                    className={`w-full text-left rounded-lg p-3 transition-all duration-150 group border-2 ${
                      isSelected
                        ? "shadow-md scale-[1.02]"
                        : "border-transparent hover:bg-muted/60 hover:scale-[1.01]"
                    }`}
                    style={{
                      backgroundColor: isSelected ? `${color}18` : undefined,
                      borderColor: isSelected ? color : "transparent",
                      borderLeft: `4px solid ${color}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-medium text-sm truncate ${
                          isSelected ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {zona.nombre}
                      </span>
                      <Badge
                        className="text-xs min-w-6 justify-center"
                        style={{
                          backgroundColor: count > 0 ? color : undefined,
                          color: count > 0 ? "#fff" : undefined,
                        }}
                        variant={count > 0 ? "default" : "secondary"}
                      >
                        {count}
                      </Badge>
                    </div>
                    {count > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {asignaciones
                          .filter((a) => a.zonaId === zona.id)
                          .slice(0, 4)
                          .map((a) => {
                            const movil = moviles.find((m) => m.id === a.movilId);
                            return (
                              <span
                                key={a.movilId}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-background border truncate max-w-20"
                              >
                                {movil?.nombre || a.movilId}
                              </span>
                            );
                          })}
                        {count > 4 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background border text-muted-foreground">
                            +{count - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
              {zonas.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay zonas disponibles
                </div>
              )}
            </div>
          </div>

          {/* ── Panel derecho: Móviles ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedZona ? (
              <>
                {/* Header de zona seleccionada */}
                <div
                  className="px-5 py-3 border-b flex items-center gap-3"
                  style={{ backgroundColor: `${selectedZonaColor}10` }}
                >
                  <div
                    className="w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: selectedZonaColor }}
                  />
                  <h3 className="font-semibold">{selectedZonaData?.nombre}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {countByZona[selectedZona] || 0} móviles asignados
                  </Badge>
                </div>

                {/* Barra de búsqueda y filtros */}
                <div className="px-5 py-3 border-b flex gap-3 items-center">
                  <Input
                    placeholder="Buscar móvil..."
                    value={searchMovil}
                    onChange={(e) => setSearchMovil(e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={tipoServicioFilter}
                    onValueChange={setTipoServicioFilter}
                  >
                    <SelectTrigger className="w-40">
                      {tipoServicioFilter === "__todos__"
                        ? "Tipo servicio"
                        : tipoServicioFilter}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__todos__">Todos</SelectItem>
                      {TIPOS_SERVICIO.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={turnoFilter} onValueChange={setTurnoFilter}>
                    <SelectTrigger className="w-30">
                      {turnoFilter === "__todos__" ? "Turno" : turnoFilter}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__todos__">Todos</SelectItem>
                      {TURNOS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Lista de móviles */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {filteredMoviles.map((movil) => {
                      const isAssigned = assignedMovilIds.has(movil.id);
                      const asignacion = getAsignacion(movil.id);
                      const otherZonas = getMovilZonas(movil.id).filter(
                        (z) => z.id !== selectedZona
                      );

                      // Filtrar por tipo servicio y turno si están asignados
                      if (isAssigned && asignacion) {
                        if (
                          tipoServicioFilter !== "__todos__" &&
                          asignacion.tipoServicio !== tipoServicioFilter
                        )
                          return null;
                        if (
                          turnoFilter !== "__todos__" &&
                          asignacion.turno !== turnoFilter
                        )
                          return null;
                      }

                      return (
                        <div
                          key={movil.id}
                          className={`rounded-xl border-2 p-3 transition-all duration-200 cursor-pointer ${
                            isAssigned
                              ? "shadow-md"
                              : "border-transparent bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/20"
                          }`}
                          style={{
                            borderColor: isAssigned ? selectedZonaColor : undefined,
                            backgroundColor: isAssigned
                              ? `${selectedZonaColor}08`
                              : undefined,
                          }}
                          onClick={() => toggleMovil(movil.id)}
                        >
                          <div className="flex items-center gap-3">
                            {/* Indicador de asignación */}
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                                isAssigned ? "text-white shadow-md" : "bg-muted text-muted-foreground"
                              }`}
                              style={{
                                backgroundColor: isAssigned ? selectedZonaColor : undefined,
                              }}
                            >
                              {isAssigned ? "✓" : movil.nombre.charAt(0)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                  {movil.nombre}
                                </span>
                                {/* Dots de otras zonas */}
                                {otherZonas.length > 0 && (
                                  <div className="flex gap-0.5">
                                    {otherZonas.slice(0, 5).map((z, i) => (
                                      <div
                                        key={z.id}
                                        className="w-2 h-2 rounded-full"
                                        style={{
                                          backgroundColor: getZoneColor(
                                            z,
                                            zonas.indexOf(z)
                                          ),
                                        }}
                                        title={z.nombre}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Selectores de tipo y turno (solo si asignado) */}
                              {isAssigned && asignacion && (
                                <div
                                  className="flex gap-2 mt-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Select
                                    value={asignacion.tipoServicio}
                                    onValueChange={(v) =>
                                      updateTipoServicio(movil.id, v)
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs w-32">
                                      {asignacion.tipoServicio}
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TIPOS_SERVICIO.map((t) => (
                                        <SelectItem key={t} value={t}>
                                          {t}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={asignacion.turno}
                                    onValueChange={(v) =>
                                      updateTurno(movil.id, v)
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs w-25">
                                      {asignacion.turno}
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TURNOS.map((t) => (
                                        <SelectItem key={t} value={t}>
                                          {t}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>

                            {/* Indicador visual de toggle */}
                            <div
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                isAssigned
                                  ? "border-transparent text-white"
                                  : "border-muted-foreground/30"
                              }`}
                              style={{
                                backgroundColor: isAssigned ? selectedZonaColor : undefined,
                              }}
                            >
                              {isAssigned && (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path
                                    d="M2 6L5 9L10 3"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredMoviles.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      No se encontraron móviles
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Seleccioná una zona para ver y asignar móviles
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {asignaciones.length} asignaciones en total ·{" "}
            {new Set(asignaciones.map((a) => a.movilId)).size} móviles asignados ·{" "}
            {new Set(asignaciones.map((a) => a.zonaId)).size} zonas con móviles
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Guardar asignaciones
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
