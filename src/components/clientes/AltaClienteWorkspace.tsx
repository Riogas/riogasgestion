"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DireccionEditor } from "@/components/clientes/DireccionEditor";
import { MapaDirecciones } from "@/components/clientes/MapaDirecciones";
import { useCreateCliente } from "@/hooks/clientes";
import { getTiposCliente } from "@/services/catalogos";
import { geocode, reverseGeocode } from "@/services/geocode";
import {
  createClienteSchema,
  type CreateClienteFormValues,
} from "@/lib/types/cliente";

const NONE = "__none__";

const DEFAULT_VALUES: CreateClienteFormValues = {
  nombre: "",
  ruc: null,
  cedula: null,
  email: "",
  tipoClienteId: null,
  categoriaPrecioId: null,
  estado: "A",
  vip: false,
  observaciones: null,
  observacionesComerc: null,
  telefonos: [{ numero: "", tipo: null, estado: "A", alias: null, principal: true }],
  direcciones: [
    {
      calle: "",
      nro: null,
      esquina1: null,
      esquina2: null,
      apto: null,
      local: null,
      departamentoId: null,
      localidadId: null,
      lat: null,
      lng: null,
      direccion: null,
      principal: true,
      estado: "A",
    },
  ],
};

export function AltaClienteWorkspace() {
  const router = useRouter();
  const createCliente = useCreateCliente();
  const [activeDirIndex, setActiveDirIndex] = useState(0);
  const [geolocating, setGeolocating] = useState(false);
  const [geoCalles, setGeoCalles] = useState<Record<number, string | null>>({});

  const { data: tipos = [] } = useQuery({
    queryKey: ["catalogos", "tipos-cliente"],
    queryFn: getTiposCliente,
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateClienteFormValues>({
    resolver: zodResolver(createClienteSchema) as never,
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const dirArray = useFieldArray({ control, name: "direcciones" });
  const telArray = useFieldArray({ control, name: "telefonos" });

  const direcciones = watch("direcciones");
  const telefonos = watch("telefonos");
  const tipoValue = watch("tipoClienteId");

  const mapPins = (direcciones ?? []).map((d) => ({
    lat: d.lat ?? null,
    lng: d.lng ?? null,
  }));

  const setDirField = (
    idx: number,
    patch: Partial<CreateClienteFormValues["direcciones"][number]>,
  ) => {
    const current = direcciones[idx];
    setValue(`direcciones.${idx}`, { ...current, ...patch }, { shouldDirty: true });
  };

  const setDirPrincipal = (idx: number) => {
    direcciones.forEach((_, i) =>
      setValue(`direcciones.${i}.principal`, i === idx, { shouldDirty: true }),
    );
  };

  const setTelPrincipal = (idx: number) => {
    telefonos.forEach((_, i) =>
      setValue(`telefonos.${i}.principal`, i === idx, { shouldDirty: true }),
    );
  };

  const handleGeolocate = async (idx: number) => {
    const dir = direcciones[idx];
    const parts = [dir.calle, dir.nro].filter(Boolean).join(" ");
    if (!parts.trim()) {
      toast.error("Escribí una calle para geolocalizar");
      return;
    }
    setGeolocating(true);
    try {
      const res = await geocode(`${parts}, Uruguay`);
      if (!res) {
        toast.error("No se encontró la dirección");
        return;
      }
      setDirField(idx, { lat: res.lat, lng: res.lng });
      setGeoCalles((g) => ({ ...g, [idx]: res.calle ?? null }));
    } finally {
      setGeolocating(false);
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    const idx = activeDirIndex;
    setDirField(idx, { lat, lng });
    const res = await reverseGeocode(lat, lng);
    if (res) {
      const dir = direcciones[idx];
      setDirField(idx, {
        lat,
        lng,
        calle: dir.calle || res.calle || dir.calle,
      });
      setGeoCalles((g) => ({ ...g, [idx]: res.calle ?? null }));
    }
  };

  const addDireccion = () => {
    dirArray.append({
      calle: "",
      nro: null,
      esquina1: null,
      esquina2: null,
      apto: null,
      local: null,
      departamentoId: null,
      localidadId: null,
      lat: null,
      lng: null,
      direccion: null,
      principal: false,
      estado: "A",
    });
    setActiveDirIndex(dirArray.fields.length);
  };

  const addTelefono = () => {
    telArray.append({ numero: "", tipo: null, estado: "A", alias: null, principal: false });
  };

  const onSubmit = handleSubmit(
    async (data) => {
      try {
        const nuevo = await createCliente.mutateAsync(data);
        toast.success("Cliente creado correctamente");
        router.push(`/dashboard/clientes/${nuevo.id}`);
      } catch {
        toast.error("Error al crear el cliente. Verificá los datos.");
      }
    },
    () => {
      toast.error("Revisá los datos: nombre, 1 teléfono y 1 dirección con un principal cada uno");
    },
  );

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6" noValidate>
      {/* ── Columna izquierda: form ── */}
      <div className="space-y-6">
        {/* Datos */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Datos del cliente
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="alta-nombre">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input id="alta-nombre" {...register("nombre")} placeholder="Ej: Juan Pérez" />
              {errors.nombre && (
                <p className="text-xs text-destructive">{errors.nombre.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="alta-email">Email</Label>
              <Input id="alta-email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="alta-ruc">RUC</Label>
              <Input id="alta-ruc" {...register("ruc")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="alta-cedula">Cédula</Label>
              <Input id="alta-cedula" {...register("cedula")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="alta-tipo">Tipo de cliente</Label>
              <Select
                value={tipoValue != null ? String(tipoValue) : NONE}
                onValueChange={(v) =>
                  setValue("tipoClienteId", v === NONE ? null : Number(v), {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="alta-tipo">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Sin tipo —</SelectItem>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.descripcion ?? `Tipo ${t.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Controller
                control={control}
                name="vip"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="rounded border-border"
                    />
                    Cliente VIP
                  </label>
                )}
              />
            </div>
          </div>
        </fieldset>

        {/* Direcciones */}
        <fieldset className="space-y-3">
          <div className="flex items-center justify-between">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Direcciones
            </legend>
            <Button type="button" variant="outline" size="sm" onClick={addDireccion} className="gap-1.5">
              <Plus className="size-4" />
              Dirección
            </Button>
          </div>
          {typeof errors.direcciones?.message === "string" && (
            <p className="text-xs text-destructive">{errors.direcciones.message}</p>
          )}

          {dirArray.fields.map((field, idx) => {
            const isActive = idx === activeDirIndex;
            const dir = direcciones[idx];
            return (
              <div
                key={field.id}
                className={`rounded-lg border p-3 space-y-3 ${
                  isActive ? "border-primary" : "border-border"
                }`}
                onClick={() => setActiveDirIndex(idx)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={isActive ? "info" : "secondary"} className="text-[10px]">
                      #{idx + 1}
                    </Badge>
                    {dir?.lat == null && (
                      <Badge variant="secondary" className="text-[10px]">
                        s/coord
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDirPrincipal(idx)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      aria-label="Marcar como principal"
                    >
                      <Star
                        className={`size-4 ${
                          dir?.principal ? "text-amber-500 fill-amber-500" : ""
                        }`}
                      />
                    </button>
                    {dirArray.fields.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => dirArray.remove(idx)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <DireccionEditor
                  value={{ ...dir, _geoCalle: geoCalles[idx] ?? null }}
                  onChange={(patch) => setDirField(idx, patch)}
                  onGeolocate={() => handleGeolocate(idx)}
                  geolocating={geolocating && isActive}
                  onFocus={() => setActiveDirIndex(idx)}
                />
              </div>
            );
          })}
        </fieldset>

        {/* Teléfonos */}
        <fieldset className="space-y-3">
          <div className="flex items-center justify-between">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Teléfonos
            </legend>
            <Button type="button" variant="outline" size="sm" onClick={addTelefono} className="gap-1.5">
              <Plus className="size-4" />
              Teléfono
            </Button>
          </div>
          {typeof errors.telefonos?.message === "string" && (
            <p className="text-xs text-destructive">{errors.telefonos.message}</p>
          )}

          {telArray.fields.map((field, idx) => {
            const tel = telefonos[idx];
            return (
              <div key={field.id} className="flex items-end gap-2 rounded-lg border border-border p-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Número</Label>
                  <Input {...register(`telefonos.${idx}.numero`)} placeholder="099 123 456" />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Alias</Label>
                  <Input {...register(`telefonos.${idx}.alias`)} placeholder="Casa" />
                </div>
                <button
                  type="button"
                  onClick={() => setTelPrincipal(idx)}
                  className="pb-2 text-muted-foreground hover:text-foreground"
                  aria-label="Marcar como principal"
                >
                  <Star
                    className={`size-4 ${tel?.principal ? "text-amber-500 fill-amber-500" : ""}`}
                  />
                </button>
                {telArray.fields.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-destructive shrink-0"
                    onClick={() => telArray.remove(idx)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </fieldset>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/60">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/clientes")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createCliente.isPending || isSubmitting} className="gap-2">
            {(createCliente.isPending || isSubmitting) && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Crear cliente
          </Button>
        </div>
      </div>

      {/* ── Columna derecha: mapa ── */}
      <div className="lg:sticky lg:top-20 h-[60vh] lg:h-[calc(100vh-8rem)] rounded-lg overflow-hidden border border-border">
        <MapaDirecciones
          direcciones={mapPins}
          activeIndex={activeDirIndex}
          onMapClick={handleMapClick}
          onPinMove={(_idx, lat, lng) => handleMapClick(lat, lng)}
        />
      </div>
    </form>
  );
}
