"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Moon,
  MousePointerClick,
  PenLine,
  Plus,
  Spline,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ALL_SERVICES,
  SERVICE_LABEL,
  ZONE_COLORS,
  ZONE_TYPE_LABEL,
  type ServiceType,
  type Zone,
  type ZoneType,
} from "@/lib/types/zona";

const SERVICE_ICON: Record<ServiceType, typeof Zap> = {
  URGENTE: Zap,
  SERVICE: Clock,
  NOCTURNO: Moon,
};

export interface ZoneFormValues {
  name: string;
  description: string;
  color: string;
  zoneType: ZoneType;
  services: ServiceType[];
}

// Textarea con la misma estética que Input (no existe ui/textarea en el proyecto).
function Textarea(props: React.ComponentProps<"textarea">) {
  const { className, ...rest } = props;
  return (
    <textarea
      className={cn(
        "flex min-h-20 w-full rounded-[var(--radius-md)] bg-card text-foreground",
        "border-[1.5px] border-input px-3.5 py-2 text-sm shadow-xs",
        "placeholder:text-muted-foreground resize-none",
        "transition-[border-color,box-shadow] duration-150",
        "outline-none focus-visible:border-primary focus-visible:shadow-[var(--shadow-glow-primary)]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

interface ZoneEditorPanelProps {
  /** Zona seleccionada (modo edición); null en creación o sin selección. */
  zone: Zone | null;
  /** Modo creación de una zona nueva. */
  creating: boolean;
  /** En creación: cantidad de puntos del polígono dibujado (0 = sin dibujar). */
  draftPoints: number;
  saving: boolean;
  onSave: (values: ZoneFormValues) => void;
  onDelete: () => void;
  onClose: () => void;
  onCancelCreate: () => void;
  onEditGeometry: () => void;
  onNewZone: () => void;
}

export function ZoneEditorPanel({
  zone,
  creating,
  draftPoints,
  saving,
  onSave,
  onDelete,
  onClose,
  onCancelCreate,
  onEditGeometry,
  onNewZone,
}: ZoneEditorPanelProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(ZONE_COLORS[0]);
  const [zoneType, setZoneType] = useState<ZoneType | null>(null);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [nameError, setNameError] = useState(false);
  const [typeError, setTypeError] = useState(false);

  // Reset del formulario al cambiar de zona o de modo.
  useEffect(() => {
    if (zone) {
      setName(zone.name);
      setDescription(zone.description ?? "");
      setColor(zone.color);
      setZoneType(zone.zoneType);
      setServices([...zone.services]);
    } else {
      setName("");
      setDescription("");
      setColor(ZONE_COLORS[0]);
      setZoneType(null);
      setServices([]);
    }
    setNameError(false);
    setTypeError(false);
  }, [zone?.id, creating]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sin selección ni creación ──────────────────────────────────────────────
  if (!zone && !creating) {
    return (
      <Card className="px-5">
        <EmptyState
          icon={MousePointerClick}
          size="sm"
          title="Sin zona seleccionada"
          description="Seleccioná una zona del mapa o de la lista para editarla."
          action={
            <Button size="sm" onClick={onNewZone}>
              <Plus className="size-4" />
              Nueva zona
            </Button>
          }
        />
      </Card>
    );
  }

  const toggleService = (s: ServiceType) =>
    setServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const handleSave = () => {
    const nameOk = name.trim().length > 0;
    const typeOk = zoneType !== null;
    setNameError(!nameOk);
    setTypeError(!typeOk);
    if (!nameOk || !typeOk) return;
    if (creating && draftPoints < 3) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      color,
      zoneType: zoneType as ZoneType,
      services,
    });
  };

  const canSave = !saving && (!creating || draftPoints >= 3);

  return (
    <Card className="gap-4 px-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="size-3.5 shrink-0 rounded-full ring-2 ring-border"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {creating ? "Nueva zona" : zone?.name}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {creating
                ? draftPoints >= 3
                  ? `Polígono listo (${draftPoints} puntos)`
                  : "Dibujá el polígono en el mapa"
                : `ID: ${zone?.code}`}
              {!creating && zone?.syncEstado === "SYNCED" && (
                <span
                  className="text-success"
                  title={`Espejada en TrackMovil (zona ${zone.trackZonaId})`}
                >
                  ⇄
                </span>
              )}
              {!creating && zone?.syncEstado === "ERROR" && (
                <span
                  className="inline-flex items-center gap-0.5 text-destructive"
                  title={zone?.syncError ?? "Error de sincronización con TrackMovil"}
                >
                  <AlertTriangle className="size-3" />
                  sync
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          {!creating && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              title="Eliminar zona"
              aria-label="Eliminar zona"
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="Cerrar"
            aria-label="Cerrar"
            onClick={creating ? onCancelCreate : onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="informacion">
        <TabsList>
          <TabsTrigger value="informacion">Información</TabsTrigger>
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
        </TabsList>

        {/* ── Tab Información ─────────────────────────────────────────────── */}
        <TabsContent value="informacion" className="flex flex-col gap-4">
          <Field label="Nombre">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(false);
              }}
              placeholder="Ej: Zona Norte"
              aria-invalid={nameError || undefined}
            />
            {nameError && (
              <p className="mt-1 text-xs text-destructive">
                El nombre es obligatorio.
              </p>
            )}
          </Field>

          <Field label="Descripción">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describí el alcance de la zona..."
            />
          </Field>

          <Field label="Color">
            <div className="flex flex-wrap items-center gap-2">
              {ZONE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full transition-transform hover:scale-110",
                    color.toLowerCase() === c.toLowerCase() &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Input
              value={color}
              onChange={(e) => {
                const v = e.target.value;
                setColor(v);
              }}
              placeholder="#8B5CF6"
              className="mt-2 font-mono text-xs uppercase"
              maxLength={7}
            />
          </Field>

          <Field label="Tipo de zona">
            <div
              className={cn(
                "grid grid-cols-2 gap-1 rounded-lg border border-input p-1",
                typeError && "border-destructive",
              )}
            >
              {(["DISTRIBUCION", "FLETE"] as ZoneType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setZoneType(t);
                    setTypeError(false);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    zoneType === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {ZONE_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            {typeError && (
              <p className="mt-1 text-xs text-destructive">
                Seleccioná el tipo de zona.
              </p>
            )}
          </Field>

          <Field label="Tipo de servicio">
            <div className="grid grid-cols-3 gap-2">
              {ALL_SERVICES.map((s) => {
                const Icon = SERVICE_ICON[s];
                const active = services.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleService(s)}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors",
                      active
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-input text-muted-foreground hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    {SERVICE_LABEL[s]}
                  </button>
                );
              })}
            </div>
            {services.length === 0 && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-warn">
                <AlertTriangle className="size-3.5" />
                Esta zona no tiene servicios asociados.
              </p>
            )}
          </Field>

          {creating && draftPoints < 3 && (
            <p className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              <PenLine className="size-3.5 text-primary" />
              Falta dibujar el polígono (mínimo 3 puntos).
            </p>
          )}

          <div className="flex gap-2 pt-1">
            {creating ? (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onCancelCreate}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={!canSave}
                >
                  <Check className="size-4" />
                  {saving ? "Guardando..." : "Guardar zona"}
                </Button>
              </>
            ) : (
              <Button className="w-full" onClick={handleSave} disabled={!canSave}>
                <Check className="size-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            )}
          </div>

          {!creating && (
            <Button variant="outline" size="sm" onClick={onEditGeometry}>
              <Spline className="size-4" />
              Editar polígono en el mapa
            </Button>
          )}
        </TabsContent>

        {/* ── Tab Servicios ───────────────────────────────────────────────── */}
        <TabsContent value="servicios" className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {services.length ? (
              services.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="border-primary/40 bg-primary/10 text-foreground"
                >
                  {SERVICE_LABEL[s]}
                </Badge>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin servicios activos.
              </p>
            )}
          </div>

          <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border">
            {ALL_SERVICES.map((s) => {
              const Icon = SERVICE_ICON[s];
              return (
                <div
                  key={s}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-foreground">
                    <Icon className="size-4 text-muted-foreground" />
                    {SERVICE_LABEL[s]}
                  </span>
                  <Switch
                    checked={services.includes(s)}
                    onCheckedChange={() => toggleService(s)}
                    aria-label={`Activar ${SERVICE_LABEL[s]}`}
                  />
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            Los cambios de servicios se aplican al guardar desde la pestaña
            Información o con el botón de abajo.
          </p>

          <Button className="w-full" onClick={handleSave} disabled={!canSave}>
            <Check className="size-4" />
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
