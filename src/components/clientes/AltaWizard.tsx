"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Datos" },
  { id: 2, label: "Dirección" },
  { id: 3, label: "Confirmar" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ─── Fields per step (for trigger validation) ────────────────────────────────

const STEP_FIELDS: Record<
  StepId,
  (keyof CreateClienteFormValues | `telefonos.0.numero`)[]
> = {
  1: ["nombre", "tipoCliente", "telefonos.0.numero"],
  2: ["direcciones"],
  3: [],
};

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoCliente, string> = {
  [TipoCliente.DOMESTICO]: "Doméstico",
  [TipoCliente.COMERCIAL]: "Comercial",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AltaWizard() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(1);

  // Local address picker state (drives AddressPicker UI, syncs to RHF)
  const [addressValue, setAddressValue] = useState<AddressPickerValue>({});

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateClienteFormValues>({
    resolver: zodResolver(createClienteSchema) as any,
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const createCliente = useCreateCliente();

  // I3: watch() is reactive — Confirmar paso siempre muestra datos actuales
  const values = watch();
  const tipoValue = values.tipoCliente;

  // ── Address sync ───────────────────────────────────────────────────────────
  // I2: also propagate departamentoId / localidadId
  const handleAddressChange = useCallback(
    (patch: Partial<AddressPickerValue>) => {
      setAddressValue((prev) => {
        const next = { ...prev, ...patch };
        if (next.calle !== undefined)
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
        // I2: propagate real IDs
        if ("departamentoId" in patch)
          setValue("direcciones.0.departamentoId", next.departamentoId ?? null);
        if ("localidadId" in patch)
          setValue("direcciones.0.localidadId", next.localidadId ?? null);
        return next;
      });
    },
    [setValue],
  );

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleNext = async () => {
    const fields = STEP_FIELDS[step];
    const valid = await trigger(
      fields as Parameters<typeof trigger>[0],
    );
    if (!valid) return;
    setStep((s) => Math.min(3, s + 1) as StepId);
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1) as StepId);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = handleSubmit(async (data) => {
    try {
      const nuevo = await createCliente.mutateAsync(data);
      toast.success("Cliente creado correctamente");
      router.push(`/dashboard/clientes/${nuevo.id}`);
    } catch {
      toast.error("Error al crear el cliente. Verificá los datos.");
    }
  });

  // ── Progress ───────────────────────────────────────────────────────────────
  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

  // I5: form wraps everything; Enter on steps 1/2 triggers handleNext (type=submit
  // on Siguiente button), not the final create. Step 3 submit = crear.
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step < 3) {
      handleNext();
    } else {
      onSubmit(e as unknown as React.BaseSyntheticEvent);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Progress bar ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors",
                  step > s.id
                    ? "bg-primary border-primary text-primary-foreground"
                    : step === s.id
                      ? "bg-background border-primary text-primary"
                      : "bg-background border-border text-muted-foreground",
                )}
              >
                {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  step === s.id ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {s.id < STEPS.length && (
                <div className="hidden sm:block w-16 mx-2 h-px bg-border" />
              )}
            </div>
          ))}
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      {/* I5: single form element wrapping all steps */}
      <form onSubmit={handleFormSubmit} noValidate>
        {/* ── Step 1: Datos ── */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Datos del cliente</h2>

            {/* Nombre / Apellido */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="wiz-nombre" className="text-sm">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wiz-nombre"
                  {...register("nombre")}
                  className={cn("mt-1", errors.nombre && "border-destructive")}
                  placeholder="Ej: Juan"
                />
                {errors.nombre && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.nombre.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="wiz-apellido" className="text-sm">
                  Apellido
                </Label>
                <Input
                  id="wiz-apellido"
                  {...register("apellido")}
                  className="mt-1"
                  placeholder="Ej: Pérez"
                />
              </div>
            </div>

            {/* Teléfono */}
            <div>
              <Label htmlFor="wiz-telefono" className="text-sm">
                Teléfono principal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wiz-telefono"
                {...register("telefonos.0.numero")}
                className={cn(
                  "mt-1",
                  errors.telefonos?.[0]?.numero && "border-destructive",
                )}
                placeholder="Ej: 099 123 456"
              />
              {errors.telefonos?.[0]?.numero && (
                <p className="text-xs text-destructive mt-1">
                  {errors.telefonos[0].numero?.message}
                </p>
              )}
            </div>

            {/* Tipo / Email */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="wiz-tipo" className="text-sm">
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
                  <SelectTrigger id="wiz-tipo" className="mt-1">
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
              <div>
                <Label htmlFor="wiz-email" className="text-sm">
                  Email
                </Label>
                <Input
                  id="wiz-email"
                  type="email"
                  {...register("email")}
                  className={cn("mt-1", errors.email && "border-destructive")}
                  placeholder="cliente@ejemplo.com"
                />
                {errors.email && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            {/* RUT/CI / GCI */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="wiz-rutci" className="text-sm">
                  RUT / CI
                </Label>
                <Input
                  id="wiz-rutci"
                  {...register("rutCi")}
                  className="mt-1"
                  placeholder="Ej: 21234567-8"
                />
              </div>
              <div>
                <Label htmlFor="wiz-gci" className="text-sm">
                  GCI
                </Label>
                <Input id="wiz-gci" {...register("gci")} className="mt-1" />
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <Label htmlFor="wiz-obs" className="text-sm">
                Observaciones
              </Label>
              <textarea
                id="wiz-obs"
                {...register("obsCliente")}
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                placeholder="Notas internas..."
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Dirección ── */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Dirección principal</h2>
            {errors.direcciones && !Array.isArray(errors.direcciones) && (
              <p className="text-sm text-destructive">
                {(errors.direcciones as { message?: string }).message}
              </p>
            )}
            {errors.direcciones?.[0]?.calle && (
              <p className="text-sm text-destructive">
                {errors.direcciones[0].calle?.message}
              </p>
            )}
            <AddressPicker
              value={addressValue}
              onChange={handleAddressChange}
            />
          </div>
        )}

        {/* ── Step 3: Confirmar ── */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Confirmar datos</h2>
            <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden bg-muted/20">
              {/* Sección datos */}
              <div className="px-5 py-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Datos del cliente
                </p>
                <ConfirmRow
                  label="Nombre"
                  value={
                    [values.nombre, values.apellido].filter(Boolean).join(" ") ||
                    "—"
                  }
                />
                <ConfirmRow
                  label="Tipo"
                  value={
                    <Badge variant="secondary" className="text-xs">
                      {TIPO_LABEL[values.tipoCliente]}
                    </Badge>
                  }
                />
                <ConfirmRow
                  label="Teléfono"
                  value={values.telefonos[0]?.numero || "—"}
                />
                <ConfirmRow label="Email" value={values.email || "—"} />
                <ConfirmRow label="RUT/CI" value={values.rutCi || "—"} />
                <ConfirmRow label="GCI" value={values.gci || "—"} />
                {values.obsCliente && (
                  <ConfirmRow label="Observaciones" value={values.obsCliente} />
                )}
              </div>

              {/* Sección dirección */}
              <div className="px-5 py-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Dirección principal
                </p>
                {(() => {
                  const dir = values.direcciones[0];
                  if (!dir) return <p className="text-sm text-muted-foreground">Sin dirección</p>;
                  const parts = [
                    dir.calle,
                    dir.nroPuerta ? `Nº ${dir.nroPuerta}` : null,
                    dir.esquina1 ? `esq. ${dir.esquina1}` : null,
                    dir.apto ? `Apto ${dir.apto}` : null,
                  ].filter(Boolean);
                  return (
                    <>
                      <ConfirmRow
                        label="Dirección"
                        value={parts.join(", ") || "—"}
                      />
                      {dir.zona && (
                        <ConfirmRow
                          label="Zona"
                          value={
                            <Badge variant="success" className="text-xs">
                              {dir.zona}
                            </Badge>
                          }
                        />
                      )}
                      {dir.lat && dir.lng && (
                        <ConfirmRow
                          label="Coordenadas"
                          value={`${dir.lat.toFixed(5)}, ${dir.lng.toFixed(5)}`}
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/60">
          {/* I5: Atrás/Cancelar are type="button" so they don't trigger form submit */}
          <Button
            type="button"
            variant="outline"
            onClick={step === 1 ? () => router.push("/dashboard/clientes") : handleBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? "Cancelar" : "Atrás"}
          </Button>

          {step < 3 ? (
            // I5: type="submit" → Enter on this step goes to Siguiente
            <Button type="submit" className="gap-2">
              Siguiente
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            // I5: type="submit" on last step → creates client
            <Button
              type="submit"
              disabled={createCliente.isPending || isSubmitting}
              className="gap-2"
            >
              {createCliente.isPending || isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Crear cliente
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Confirm row ──────────────────────────────────────────────────────────────

function ConfirmRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm font-medium flex-1">{value}</span>
    </div>
  );
}
