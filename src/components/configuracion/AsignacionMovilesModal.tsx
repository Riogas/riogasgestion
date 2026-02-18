"use client";
import React, { useState, useMemo, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export interface AsignacionEntry {
  movilId: string;
  categoria: "prioridad" | "transito";
}

/** Estado completo: por tipo de servicio → por zona → lista de asignaciones */
export type AsignacionesState = Record<string, Record<string, AsignacionEntry[]>>;

interface AsignacionMovilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  moviles: Movil[];
  zonas: Zona[];
  tiposServicio: string[];
  asignaciones: AsignacionesState;
  onSave: (asignaciones: AsignacionesState) => void;
}

const ZONE_COLORS = [
  "#1976d2", "#388e3c", "#d32f2f", "#ff9800", "#7b1fa2",
  "#00796b", "#c2185b", "#5d4037", "#455a64", "#f57f17",
];

function getZoneColor(zona: Zona, index: number) {
  return zona.color || ZONE_COLORS[index % ZONE_COLORS.length];
}

// ── Drag data ──
interface DragData {
  movilId: string;
  source: "available" | "prioridad" | "transito";
}

export default function AsignacionMovilesModal({
  isOpen,
  onClose,
  moviles,
  zonas,
  tiposServicio,
  asignaciones: initialAsignaciones,
  onSave,
}: AsignacionMovilesModalProps) {
  const [state, setState] = useState<AsignacionesState>(initialAsignaciones);
  const [selectedTipo, setSelectedTipo] = useState(tiposServicio[0] || "");
  const [selectedZona, setSelectedZona] = useState<string | null>(
    zonas.length > 0 ? zonas[0].id : null
  );
  const [searchMovil, setSearchMovil] = useState("");
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});

  // Reset al abrir
  React.useEffect(() => {
    if (isOpen) {
      setState(initialAsignaciones);
      setSelectedTipo(tiposServicio[0] || "");
      setSelectedZona(zonas.length > 0 ? zonas[0].id : null);
      setSearchMovil("");
      setDragOverTarget(null);
    }
  }, [isOpen, initialAsignaciones, tiposServicio, zonas]);

  // ── Datos derivados ──
  const currentAssignments = useMemo(() => {
    if (!selectedZona) return [];
    return state[selectedTipo]?.[selectedZona] || [];
  }, [state, selectedTipo, selectedZona]);

  const prioridadMoviles = useMemo(
    () => currentAssignments.filter((a) => a.categoria === "prioridad"),
    [currentAssignments]
  );
  const transitoMoviles = useMemo(
    () => currentAssignments.filter((a) => a.categoria === "transito"),
    [currentAssignments]
  );
  const assignedIds = useMemo(
    () => new Set(currentAssignments.map((a) => a.movilId)),
    [currentAssignments]
  );

  const availableMoviles = useMemo(() => {
    let available = moviles.filter((m) => !assignedIds.has(m.id));
    if (searchMovil.trim()) {
      const lower = searchMovil.toLowerCase();
      available = available.filter((m) =>
        m.nombre.toLowerCase().includes(lower)
      );
    }
    return available;
  }, [moviles, assignedIds, searchMovil]);

  // Contar asignados por zona (para el tipo actual)
  const countByZona = useMemo(() => {
    const counts: Record<string, number> = {};
    const tipoState = state[selectedTipo] || {};
    Object.entries(tipoState).forEach(([zonaId, entries]) => {
      counts[zonaId] = entries.length;
    });
    return counts;
  }, [state, selectedTipo]);

  // ── Mutaciones de estado ──
  const setAssignments = useCallback(
    (zonaId: string, entries: AsignacionEntry[]) => {
      setState((prev) => ({
        ...prev,
        [selectedTipo]: {
          ...(prev[selectedTipo] || {}),
          [zonaId]: entries,
        },
      }));
    },
    [selectedTipo]
  );

  const addToCategory = useCallback(
    (movilId: string, categoria: "prioridad" | "transito") => {
      if (!selectedZona) return;
      const current = state[selectedTipo]?.[selectedZona] || [];
      // Remover si ya existe (puede estar en la otra categoría)
      const filtered = current.filter((a) => a.movilId !== movilId);
      setAssignments(selectedZona, [...filtered, { movilId, categoria }]);
    },
    [selectedZona, selectedTipo, state, setAssignments]
  );

  const removeFromAssignment = useCallback(
    (movilId: string) => {
      if (!selectedZona) return;
      const current = state[selectedTipo]?.[selectedZona] || [];
      setAssignments(
        selectedZona,
        current.filter((a) => a.movilId !== movilId)
      );
    },
    [selectedZona, selectedTipo, state, setAssignments]
  );

  // ── Drag & Drop ──
  const handleDragStart = useCallback(
    (e: React.DragEvent, movilId: string, source: DragData["source"]) => {
      const data: DragData = { movilId, source };
      e.dataTransfer.setData("application/json", JSON.stringify(data));
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent, target: string) => {
      e.preventDefault();
      dragCounterRef.current[target] =
        (dragCounterRef.current[target] || 0) + 1;
      setDragOverTarget(target);
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent, target: string) => {
      e.preventDefault();
      dragCounterRef.current[target] =
        (dragCounterRef.current[target] || 0) - 1;
      if (dragCounterRef.current[target] <= 0) {
        dragCounterRef.current[target] = 0;
        setDragOverTarget((prev) => (prev === target ? null : prev));
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (
      e: React.DragEvent,
      target: "prioridad" | "transito" | "available"
    ) => {
      e.preventDefault();
      setDragOverTarget(null);
      dragCounterRef.current = {};

      try {
        const data: DragData = JSON.parse(
          e.dataTransfer.getData("application/json")
        );
        if (target === "available") {
          removeFromAssignment(data.movilId);
        } else {
          addToCategory(data.movilId, target);
        }
      } catch {
        // Invalid drag data
      }
    },
    [addToCategory, removeFromAssignment]
  );

  // ── Stats ──
  const totalAsignaciones = useMemo(() => {
    let total = 0;
    Object.values(state).forEach((tipoState) => {
      Object.values(tipoState).forEach((entries) => {
        total += entries.length;
      });
    });
    return total;
  }, [state]);

  const handleSave = () => {
    onSave(state);
    toast.success("Asignaciones guardadas correctamente");
    onClose();
  };

  const selectedZonaData = zonas.find((z) => z.id === selectedZona);
  const selectedZonaColor = selectedZonaData
    ? getZoneColor(selectedZonaData, zonas.indexOf(selectedZonaData))
    : "#1976d2";

  const movilById = useMemo(() => {
    const map: Record<string, Movil> = {};
    moviles.forEach((m) => (map[m.id] = m));
    return map;
  }, [moviles]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-300 max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-xl">
            Asignación de Móviles a Zonas
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Seleccioná un tipo de servicio, luego una zona, y arrastrá los
            móviles a Prioridad o Tránsito.
          </p>
        </DialogHeader>

        {/* ── Tabs Tipo de Servicio ── */}
        <div className="px-6 py-3 border-b bg-muted/20">
          <div className="flex gap-2">
            {tiposServicio.map((tipo) => {
              const isActive = selectedTipo === tipo;
              return (
                <button
                  key={tipo}
                  onClick={() => setSelectedTipo(tipo)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tipo}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* ── Panel izquierdo: Zonas ── */}
          <div className="w-56 border-r bg-muted/30 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
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
                    className={`w-full text-left rounded-lg p-3 transition-all duration-150 border-2 ${
                      isSelected
                        ? "shadow-md scale-[1.02]"
                        : "border-transparent hover:bg-muted/60 hover:scale-[1.01]"
                    }`}
                    style={{
                      backgroundColor: isSelected
                        ? `${color}18`
                        : undefined,
                      borderColor: isSelected ? color : "transparent",
                      borderLeft: `4px solid ${color}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-medium text-sm truncate ${
                          isSelected
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {zona.nombre}
                      </span>
                      <Badge
                        className="text-xs min-w-6 justify-center"
                        style={{
                          backgroundColor:
                            count > 0 ? color : undefined,
                          color: count > 0 ? "#fff" : undefined,
                        }}
                        variant={count > 0 ? "default" : "secondary"}
                      >
                        {count}
                      </Badge>
                    </div>
                    {count > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {(state[selectedTipo]?.[zona.id] || [])
                          .slice(0, 3)
                          .map((a) => (
                            <span
                              key={a.movilId}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-background border truncate max-w-20"
                            >
                              {movilById[a.movilId]?.nombre ||
                                a.movilId}
                            </span>
                          ))}
                        {count > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background border text-muted-foreground">
                            +{count - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Panel central + derecho ── */}
          {selectedZona ? (
            <>
              {/* Prioridad + Tránsito */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Header zona */}
                <div
                  className="px-5 py-2.5 border-b flex items-center gap-3 shrink-0"
                  style={{
                    backgroundColor: `${selectedZonaColor}10`,
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: selectedZonaColor }}
                  />
                  <h3 className="font-semibold text-sm">
                    {selectedZonaData?.nombre}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    ({selectedTipo})
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* ── Tabla PRIORIDAD ── */}
                  <DropTable
                    title="Prioridad"
                    icon="⚡"
                    categoria="prioridad"
                    entries={prioridadMoviles}
                    movilById={movilById}
                    color={selectedZonaColor}
                    isOver={dragOverTarget === "prioridad"}
                    onDragStart={handleDragStart}
                    onDragEnter={(e) =>
                      handleDragEnter(e, "prioridad")
                    }
                    onDragLeave={(e) =>
                      handleDragLeave(e, "prioridad")
                    }
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, "prioridad")}
                    onRemove={removeFromAssignment}
                  />

                  {/* ── Tabla TRÁNSITO ── */}
                  <DropTable
                    title="Tránsito"
                    icon="🚚"
                    categoria="transito"
                    entries={transitoMoviles}
                    movilById={movilById}
                    color="#64748b"
                    isOver={dragOverTarget === "transito"}
                    onDragStart={handleDragStart}
                    onDragEnter={(e) =>
                      handleDragEnter(e, "transito")
                    }
                    onDragLeave={(e) =>
                      handleDragLeave(e, "transito")
                    }
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, "transito")}
                    onRemove={removeFromAssignment}
                  />
                </div>
              </div>

              {/* ── Panel derecho: Móviles disponibles ── */}
              <div
                className="w-64 border-l flex flex-col shrink-0"
                onDragEnter={(e) => handleDragEnter(e, "available")}
                onDragLeave={(e) => handleDragLeave(e, "available")}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "available")}
              >
                <div className="px-4 py-3 border-b">
                  <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Móviles disponibles
                  </h3>
                  <Input
                    placeholder="Buscar..."
                    value={searchMovil}
                    onChange={(e) => setSearchMovil(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div
                  className={`flex-1 overflow-y-auto p-2 space-y-1 transition-colors ${
                    dragOverTarget === "available"
                      ? "bg-red-500/10 ring-2 ring-inset ring-red-400/50"
                      : ""
                  }`}
                >
                  {availableMoviles.map((movil) => (
                    <div
                      key={movil.id}
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(e, movil.id, "available")
                      }
                      className="group flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/40 hover:bg-muted/70 cursor-grab active:cursor-grabbing transition-all border border-transparent hover:border-muted-foreground/20"
                    >
                      <svg
                        className="w-4 h-4 text-muted-foreground/50 shrink-0"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <circle cx="5" cy="3" r="1.5" />
                        <circle cx="11" cy="3" r="1.5" />
                        <circle cx="5" cy="8" r="1.5" />
                        <circle cx="11" cy="8" r="1.5" />
                        <circle cx="5" cy="13" r="1.5" />
                        <circle cx="11" cy="13" r="1.5" />
                      </svg>
                      <span className="text-sm truncate flex-1">
                        {movil.nombre}
                      </span>
                      {/* Botones rápidos */}
                      <div className="hidden group-hover:flex gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCategory(movil.id, "prioridad");
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/40 font-bold"
                          title="Agregar a Prioridad"
                        >
                          P
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCategory(movil.id, "transito");
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 hover:bg-slate-500/40 font-bold"
                          title="Agregar a Tránsito"
                        >
                          T
                        </button>
                      </div>
                    </div>
                  ))}
                  {availableMoviles.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      {searchMovil
                        ? "Sin resultados"
                        : "Todos los móviles están asignados"}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Seleccioná una zona para ver y asignar móviles
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t flex items-center justify-between bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {totalAsignaciones} asignaciones en{" "}
            {tiposServicio.length} tipos de servicio
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar asignaciones</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Drop Table Component ──
interface DropTableProps {
  title: string;
  icon: string;
  categoria: "prioridad" | "transito";
  entries: AsignacionEntry[];
  movilById: Record<string, Movil>;
  color: string;
  isOver: boolean;
  onDragStart: (
    e: React.DragEvent,
    movilId: string,
    source: DragData["source"]
  ) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: (movilId: string) => void;
}

function DropTable({
  title,
  icon,
  categoria,
  entries,
  movilById,
  color,
  isOver,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onRemove,
}: DropTableProps) {
  return (
    <div
      className={`rounded-xl border-2 transition-all duration-200 ${
        isOver ? "shadow-lg scale-[1.01]" : "border-border"
      }`}
      style={{
        borderColor: isOver ? color : undefined,
        backgroundColor: isOver ? `${color}08` : undefined,
      }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b rounded-t-xl"
        style={{ backgroundColor: `${color}12` }}
      >
        <span className="text-base">{icon}</span>
        <span className="font-semibold text-sm">{title}</span>
        <Badge
          variant="secondary"
          className="text-xs ml-auto"
          style={{
            backgroundColor:
              entries.length > 0 ? `${color}25` : undefined,
          }}
        >
          {entries.length}
        </Badge>
      </div>

      {/* Items */}
      <div className="p-2 min-h-16 space-y-1">
        {entries.map((entry, idx) => {
          const movil = movilById[entry.movilId];
          return (
            <div
              key={entry.movilId}
              draggable
              onDragStart={(e) =>
                onDragStart(e, entry.movilId, categoria)
              }
              className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/40 hover:bg-muted/60 cursor-grab active:cursor-grabbing group transition-all"
            >
              {/* Drag handle */}
              <svg
                className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <circle cx="5" cy="3" r="1.5" />
                <circle cx="11" cy="3" r="1.5" />
                <circle cx="5" cy="8" r="1.5" />
                <circle cx="11" cy="8" r="1.5" />
                <circle cx="5" cy="13" r="1.5" />
                <circle cx="11" cy="13" r="1.5" />
              </svg>
              {/* Número de orden */}
              <span
                className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white"
                style={{ backgroundColor: color }}
              >
                {idx + 1}
              </span>
              <span className="text-sm truncate flex-1">
                {movil?.nombre || entry.movilId}
              </span>
              {/* Remove button */}
              <button
                onClick={() => onRemove(entry.movilId)}
                className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all text-muted-foreground"
                title="Quitar"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M3 3L9 9M9 3L3 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          );
        })}

        {/* Empty state / drop hint */}
        {entries.length === 0 && (
          <div
            className={`flex items-center justify-center py-6 rounded-lg border-2 border-dashed transition-colors ${
              isOver
                ? "border-current text-foreground/60"
                : "border-muted-foreground/20 text-muted-foreground/50"
            }`}
          >
            <span className="text-xs">
              {isOver
                ? "Soltar aquí"
                : `Arrastrá móviles aquí para ${title}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
