"use client";

import { useCallback, useState } from "react";
import { Drawer } from "vaul";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, X } from "lucide-react";

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
import { AddressPicker, type AddressPickerValue } from "@/components/clientes/AddressPicker";
import { useCreateCliente } from "@/hooks/clientes";
import {
  createClienteSchema,
  TipoCliente,
  EstadoCliente,
  type CreateClienteFormValues,
} from "@/lib/types/cliente";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AltaSlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Default values ───────────────────────────────────────────────────────────

const DEFAULT_VALUES: CreateClienteFormValues = {
  nombre: "",
  apellido: null,
  tipoCliente: TipoCliente.DOMESTICO,
  estado: EstadoCliente.ACTIVO,
  email: null,
  rutCi: null,
  gci: null,
  categoria: null,
  privilegio: null,
  obsCliente: null,
  obsGeneral: null,
  obsComercial: null,
  telefonos: [
    {
      numero: "",
      alias: null,
      tipo: "MOVIL",
      estado: "ACTIVO",
      esPrincipal: true,
    },
  ],
  direcciones: [
    {
      calle: "",
      nroPuerta: null,
      esquina1: null,
      esquina2: null,
      apto: null,
      local: null,
      departamentoId: null,
      localidadId: null,
      zona: null,
      lat: null,
      lng: null,
      nivel: null,
      esPrincipal: true,
      enZona: null,
    },
  ],
};

// ─── Address state (local — not wired to RHF directly, gets merged on submit)
// We use a local state for the AddressPicker value and sync it to RHF on every change.

// ─── Component ────────────────────────────────────────────────────────────────

export function AltaSlideOver({ open, onOpenChange }: AltaSlideOverProps) {
  const router = useRouter();
  const [masVisible, setMasVisible] = useState(false);

  // Local address picker state (drives AddressPicker UI)
  const [addressValue, setAddressValue] = useState<AddressPickerValue>({});

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateClienteFormValues>({
    resolver: zodResolver(createClienteSchema) as any,
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const createCliente = useCreateCliente();

  // ── Address sync: when AddressPicker changes, patch RHF direcciones[0] ────
  const handleAddressChange = useCallback(
    (patch: Partial<AddressPickerValue>) => {
      setAddressValue((prev) => {
        const next = { ...prev, ...patch };
        // Map to DireccionFormValues fields
        setValue("direcciones.0.calle", next.calle ?? "", {
          shouldValidate: false,
        });
        if (next.nroPuerta !== undefined)
          setValue("direcciones.0.nroPuerta", next.nroPuerta ?? null);
        if (next.esquina1 !== undefined)
          setValue("direcciones.0.esquina1", next.esquina1 ?? null);
        if (next.esquina2 !== undefined)
          setValue("direcciones.0.esquina2", next.esquina2 ?? null);
        if (next.apto !== undefined)
          setValue("direcciones.0.apto", next.apto ?? null);
        if (next.local !== undefined)
          setValue("direcciones.0.local", next.local ?? null);
        if (next.lat !== undefined)
          setValue("direcciones.0.lat", next.lat ?? null);
        if (next.lng !== undefined)
          setValue("direcciones.0.lng", next.lng ?? null);
        if (next.zona !== undefined)
          setValue("direcciones.0.zona", next.zona ?? null);
        return next;
      });
    },
    [setValue],
  );

  // ── Reset form + address state ─────────────────────────────────────────────
  const resetForm = useCallback(() => {
    reset(DEFAULT_VALUES);
    setAddressValue({});
    setMasVisible(false);
  }, [reset]);

  // ── Submit handlers ────────────────────────────────────────────────────────

  const onCrearYAbrir = handleSubmit(async (data) => {
    try {
      const nuevo = await createCliente.mutateAsync(data);
      toast.success("Cliente creado correctamente");
      onOpenChange(false);
      resetForm();
      router.push(`/dashboard/clientes/${nuevo.id}`);
    } catch {
      toast.error("Error al crear el cliente. Verificá los datos.");
    }
  });

  const onCrearYOtro = handleSubmit(async (data) => {
    try {
      await createCliente.mutateAsync(data);
      toast.success("Cliente creado. Podés cargar el siguiente.");
      resetForm();
    } catch {
      toast.error("Error al crear el cliente. Verificá los datos.");
    }
  });

  // ── Handle close ──────────────────────────────────────────────────────────
  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const tipoValue = watch("tipoCliente");

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
        else onOpenChange(v);
      }}
      direction="right"
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className={cn(
            "fixed right-0 top-0 bottom-0 z-50 flex flex-col",
            "w-full max-w-xl bg-background border-l border-border shadow-2xl",
            "focus:outline-none",
          )}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 shrink-0">
            <div>
              <Drawer.Title className="text-base font-semibold">
                Nuevo cliente
              </Drawer.Title>
              <Drawer.Description className="text-xs text-muted-foreground mt-0.5">
                Alta rápida. Para flujo guiado usá «Alta detallada».
              </Drawer.Description>
            </div>
            <button
              onClick={handleClose}
              className="rounded-md p-1.5 hover:bg-muted transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* ── Datos esenciales ── */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Datos principales
              </legend>

              {/* Nombre */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="alta-nombre" className="text-xs">
                    Nombre <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="alta-nombre"
                    {...register("nombre")}
                    className={cn(
                      "h-9 text-sm",
                      errors.nombre && "border-destructive",
                    )}
                    placeholder="Ej: Juan"
                  />
                  {errors.nombre && (
                    <p className="text-[11px] text-destructive mt-1">
                      {errors.nombre.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="alta-apellido" className="text-xs">
                    Apellido
                  </Label>
                  <Input
                    id="alta-apellido"
                    {...register("apellido")}
                    className="h-9 text-sm"
                    placeholder="Ej: Pérez"
                  />
                </div>
              </div>

              {/* Teléfono principal */}
              <div>
                <Label htmlFor="alta-telefono" className="text-xs">
                  Teléfono principal{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="alta-telefono"
                  {...register("telefonos.0.numero")}
                  className={cn(
                    "h-9 text-sm",
                    errors.telefonos?.[0]?.numero && "border-destructive",
                  )}
                  placeholder="Ej: 099 123 456"
                />
                {errors.telefonos?.[0]?.numero && (
                  <p className="text-[11px] text-destructive mt-1">
                    {errors.telefonos[0].numero?.message}
                  </p>
                )}
              </div>

              {/* Tipo cliente */}
              <div>
                <Label htmlFor="alta-tipo" className="text-xs">
                  Tipo de cliente
                </Label>
                <Select
                  value={tipoValue}
                  onValueChange={(v) =>
                    setValue("tipoCliente", v as TipoCliente, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="alta-tipo" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TipoCliente.DOMESTICO}>
                      Doméstico
                    </SelectItem>
                    <SelectItem value={TipoCliente.COMERCIAL}>
                      Comercial
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </fieldset>

            {/* ── Dirección principal ── */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Dirección principal <span className="text-destructive">*</span>
              </legend>
              {errors.direcciones && !Array.isArray(errors.direcciones) && (
                <p className="text-[11px] text-destructive">
                  {(errors.direcciones as { message?: string }).message}
                </p>
              )}
              <AddressPicker
                value={addressValue}
                onChange={handleAddressChange}
              />
              {errors.direcciones?.[0]?.calle && (
                <p className="text-[11px] text-destructive">
                  {errors.direcciones[0].calle?.message}
                </p>
              )}
            </fieldset>

            {/* ── Más datos (progressive disclosure) ── */}
            <div>
              <button
                type="button"
                onClick={() => setMasVisible((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1"
              >
                {masVisible ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {masVisible ? "Ocultar" : "▸ Más datos"}
              </button>

              {masVisible && (
                <div className="mt-3 space-y-3 border-l-2 border-border/60 pl-4">
                  {/* Email */}
                  <div>
                    <Label htmlFor="alta-email" className="text-xs">
                      Email
                    </Label>
                    <Input
                      id="alta-email"
                      type="email"
                      {...register("email")}
                      className={cn(
                        "h-9 text-sm",
                        errors.email && "border-destructive",
                      )}
                      placeholder="cliente@ejemplo.com"
                    />
                    {errors.email && (
                      <p className="text-[11px] text-destructive mt-1">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* RUT/CI */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="alta-rutci" className="text-xs">
                        RUT / CI
                      </Label>
                      <Input
                        id="alta-rutci"
                        {...register("rutCi")}
                        className="h-9 text-sm"
                        placeholder="Ej: 21234567-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="alta-gci" className="text-xs">
                        GCI
                      </Label>
                      <Input
                        id="alta-gci"
                        {...register("gci")}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  {/* Observaciones */}
                  <div>
                    <Label htmlFor="alta-obs" className="text-xs">
                      Observaciones
                    </Label>
                    <textarea
                      id="alta-obs"
                      {...register("obsCliente")}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      placeholder="Notas internas sobre el cliente..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer actions ── */}
          <div className="shrink-0 border-t border-border/60 px-6 py-4 flex items-center gap-3 bg-muted/20">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={isSubmitting || createCliente.isPending}
              onClick={onCrearYOtro}
            >
              {createCliente.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Crear y agregar otro
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1"
              disabled={isSubmitting || createCliente.isPending}
              onClick={onCrearYAbrir}
            >
              {createCliente.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Crear y abrir ficha
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
