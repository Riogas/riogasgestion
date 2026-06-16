"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateCliente } from "@/hooks/clientes";
import {
  clienteSchema,
  type ClienteFormValues,
  type Cliente,
  TipoCliente,
  CategoriaCliente,
  EstadoCliente,
} from "@/lib/types/cliente";
import { cn } from "@/lib/utils";

interface DatosTabProps {
  cliente: Cliente;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function DatosTab({ cliente }: DatosTabProps) {
  const { mutate: updateCliente } = useUpdateCliente();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    formState: { errors, dirtyFields },
    getValues,
    watch,
    setValue,
    reset,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema) as any,
    defaultValues: {
      nombre: cliente.nombre,
      apellido: cliente.apellido ?? "",
      email: cliente.email ?? "",
      tipoCliente: cliente.tipoCliente,
      categoria: cliente.categoria ?? undefined,
      rutCi: cliente.rutCi ?? "",
      gci: cliente.gci ?? "",
      privilegio: cliente.privilegio ?? "",
      obsCliente: cliente.obsCliente ?? "",
      obsGeneral: cliente.obsGeneral ?? "",
      obsComercial: cliente.obsComercial ?? "",
      estado: cliente.estado,
    },
    mode: "onBlur",
  });

  // Refs to keep stable access to latest values inside callbacks/cleanup
  const clienteIdRef = useRef(cliente.id);
  const dirtyFieldsRef = useRef(dirtyFields);
  const getValuesRef = useRef(getValues);
  useEffect(() => {
    clienteIdRef.current = cliente.id;
    dirtyFieldsRef.current = dirtyFields;
    getValuesRef.current = getValues;
  });

  // Shared save executor — used both by debounce and flush-on-unmount
  const executeSave = useCallback(
    (dirty: Partial<ClienteFormValues>) => {
      if (Object.keys(dirty).length === 0) return;
      setSaveStatus("saving");
      updateCliente(
        { id: clienteIdRef.current, dto: dirty },
        {
          onSuccess: () => {
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
          },
          onError: () => {
            setSaveStatus("error");
            setTimeout(() => setSaveStatus("idle"), 3000);
          },
        }
      );
    },
    [updateCliente]
  );

  // Build dirty payload from current form state
  const buildDirtyPayload = useCallback((): Partial<ClienteFormValues> => {
    const values = getValuesRef.current();
    const currentDirty = dirtyFieldsRef.current;
    const dirty: Partial<ClienteFormValues> = {};
    for (const key of Object.keys(currentDirty) as (keyof ClienteFormValues)[]) {
      if (currentDirty[key]) {
        const v = values[key];
        (dirty as Record<string, unknown>)[key] = v === "" ? null : v;
      }
    }
    return dirty;
  }, []);

  const triggerAutosave = useCallback(
    (dirty: Partial<ClienteFormValues>) => {
      if (Object.keys(dirty).length === 0) return;

      // Cancel any pending debounce — don't leave status stuck in "saving"
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // setSaveStatus("saving") happens INSIDE the timeout, not before
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        executeSave(dirty);
      }, 600);
    },
    [executeSave]
  );

  // Flush-on-unmount: if a debounce is pending, save immediately
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        const dirty = buildDirtyPayload();
        if (Object.keys(dirty).length > 0) {
          executeSave(dirty);
        }
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when client changes (e.g., navigation) — cancel pending debounce first
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSaveStatus("idle");
    reset({
      nombre: cliente.nombre,
      apellido: cliente.apellido ?? "",
      email: cliente.email ?? "",
      tipoCliente: cliente.tipoCliente,
      categoria: cliente.categoria ?? undefined,
      rutCi: cliente.rutCi ?? "",
      gci: cliente.gci ?? "",
      privilegio: cliente.privilegio ?? "",
      obsCliente: cliente.obsCliente ?? "",
      obsGeneral: cliente.obsGeneral ?? "",
      obsComercial: cliente.obsComercial ?? "",
      estado: cliente.estado,
    });
  }, [cliente.id, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collect only dirty fields and autosave on blur
  const handleBlur = useCallback(() => {
    const values = getValues();
    const dirty: Partial<ClienteFormValues> = {};
    for (const key of Object.keys(dirtyFields) as (keyof ClienteFormValues)[]) {
      if (dirtyFields[key]) {
        const v = values[key];
        // Convert empty strings back to null for optional fields
        (dirty as Record<string, unknown>)[key] =
          v === "" ? null : v;
      }
    }
    triggerAutosave(dirty);
  }, [dirtyFields, getValues, triggerAutosave]);

  // For Select fields that don't have onBlur naturally
  const handleSelectChange = useCallback(
    (field: keyof ClienteFormValues, value: string) => {
      setValue(field, value as never, { shouldDirty: true });
      // Cancel pending debounce before scheduling a new one
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // setSaveStatus("saving") happens INSIDE the timeout
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        executeSave({ [field]: value || null } as Partial<ClienteFormValues>);
      }, 600);
    },
    [executeSave, setValue]
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Save indicator */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "text-xs transition-opacity duration-200",
          saveStatus === "idle" ? "opacity-0" : "opacity-100"
        )}
      >
        {saveStatus === "saving" && (
          <span className="text-muted-foreground">⌁ Guardando…</span>
        )}
        {saveStatus === "saved" && (
          <span className="text-emerald-600 dark:text-emerald-400">✓ Guardado</span>
        )}
        {saveStatus === "error" && (
          <span className="text-destructive">✗ Error al guardar</span>
        )}
      </div>

      {/* ── Identificación ── */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Identificación
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Nombre"
            id="nombre"
            required
            error={errors.nombre?.message}
          >
            <Input
              id="nombre"
              {...register("nombre")}
              onBlur={handleBlur}
              aria-required="true"
              aria-invalid={!!errors.nombre}
              aria-describedby={errors.nombre ? "nombre-error" : undefined}
            />
            {errors.nombre && (
              <FieldError id="nombre-error" message={errors.nombre.message!} />
            )}
          </FormField>

          <FormField label="Apellido" id="apellido" error={errors.apellido?.message}>
            <Input
              id="apellido"
              {...register("apellido")}
              onBlur={handleBlur}
              aria-invalid={!!errors.apellido}
              aria-describedby={errors.apellido ? "apellido-error" : undefined}
            />
            {errors.apellido && (
              <FieldError id="apellido-error" message={errors.apellido.message!} />
            )}
          </FormField>

          <FormField label="Email" id="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              {...register("email")}
              onBlur={handleBlur}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <FieldError id="email-error" message={errors.email.message!} />
            )}
          </FormField>

          <FormField label="RUT / CI" id="rutCi">
            <Input
              id="rutCi"
              {...register("rutCi")}
              onBlur={handleBlur}
            />
          </FormField>

          <FormField label="GCI Nº" id="gci">
            <Input
              id="gci"
              {...register("gci")}
              onBlur={handleBlur}
            />
          </FormField>

          <FormField label="Privilegio" id="privilegio">
            <Input
              id="privilegio"
              {...register("privilegio")}
              onBlur={handleBlur}
            />
          </FormField>
        </div>
      </fieldset>

      {/* ── Clasificación ── */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Clasificación
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Tipo cliente" id="tipoCliente" required>
            <Select
              value={watch("tipoCliente")}
              onValueChange={(v) => handleSelectChange("tipoCliente", v)}
            >
              <SelectTrigger id="tipoCliente">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TipoCliente.DOMESTICO}>Doméstico</SelectItem>
                <SelectItem value={TipoCliente.COMERCIAL}>Comercial</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Categoría" id="categoria">
            <Select
              value={watch("categoria") ?? ""}
              onValueChange={(v) => handleSelectChange("categoria", v)}
            >
              <SelectTrigger id="categoria">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Sin categoría —</SelectItem>
                <SelectItem value={CategoriaCliente.RESIDENCIAL}>Residencial</SelectItem>
                <SelectItem value={CategoriaCliente.COMERCIAL}>Comercial</SelectItem>
                <SelectItem value={CategoriaCliente.INDUSTRIAL}>Industrial</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Estado" id="estado" required>
            <Select
              value={watch("estado")}
              onValueChange={(v) => handleSelectChange("estado", v)}
            >
              <SelectTrigger id="estado">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EstadoCliente.ACTIVO}>Activo</SelectItem>
                <SelectItem value={EstadoCliente.INACTIVO}>Inactivo</SelectItem>
                <SelectItem value={EstadoCliente.PENDIENTE}>Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </fieldset>

      {/* ── Observaciones ── */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Observaciones
        </legend>
        <div className="space-y-4">
          <FormField label="Obs. cliente" id="obsCliente">
            <textarea
              id="obsCliente"
              {...register("obsCliente")}
              onBlur={handleBlur}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </FormField>

          <FormField label="Obs. general" id="obsGeneral">
            <textarea
              id="obsGeneral"
              {...register("obsGeneral")}
              onBlur={handleBlur}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </FormField>

          <FormField label="Obs. comercial" id="obsComercial">
            <textarea
              id="obsComercial"
              {...register("obsComercial")}
              onBlur={handleBlur}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </FormField>
        </div>
      </fieldset>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function FormField({
  label,
  id,
  required,
  error,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm">
        {label}
        {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
      </Label>
      {children}
      {error && <FieldError id={`${id}-error`} message={error} />}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} role="alert" className="text-xs text-destructive mt-0.5">
      {message}
    </p>
  );
}
