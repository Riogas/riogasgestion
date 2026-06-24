"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
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
import { getTiposCliente, getCategoriasPrecio } from "@/services/catalogos";
import {
  clienteSchema,
  type ClienteFormValues,
  type Cliente,
} from "@/lib/types/cliente";
import { cn } from "@/lib/utils";

interface DatosTabProps {
  cliente: Cliente;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const NONE = "__none__";

export function DatosTab({ cliente }: DatosTabProps) {
  const { mutate: updateCliente } = useUpdateCliente();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: tipos = [] } = useQuery({
    queryKey: ["catalogos", "tipos-cliente"],
    queryFn: getTiposCliente,
    staleTime: 5 * 60 * 1000,
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ["catalogos", "categorias-precio"],
    queryFn: getCategoriasPrecio,
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    formState: { errors, dirtyFields },
    getValues,
    watch,
    setValue,
    reset,
  } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema) as never,
    defaultValues: {
      nombre: cliente.nombre ?? "",
      ruc: cliente.ruc ?? "",
      cedula: cliente.cedula ?? "",
      email: cliente.email ?? "",
      tipoClienteId: cliente.tipoClienteId ?? null,
      categoriaPrecioId: cliente.categoriaPrecioId ?? null,
      estado: cliente.estado ?? "A",
      vip: cliente.vip ?? false,
      observaciones: cliente.observaciones ?? "",
      observacionesComerc: cliente.observacionesComerc ?? "",
    },
    mode: "onBlur",
  });

  const clienteIdRef = useRef(cliente.id);
  const dirtyFieldsRef = useRef(dirtyFields);
  const getValuesRef = useRef(getValues);
  useEffect(() => {
    clienteIdRef.current = cliente.id;
    dirtyFieldsRef.current = dirtyFields;
    getValuesRef.current = getValues;
  });

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
        },
      );
    },
    [updateCliente],
  );

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
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        executeSave(dirty);
      }, 600);
    },
    [executeSave],
  );

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

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSaveStatus("idle");
    reset({
      nombre: cliente.nombre ?? "",
      ruc: cliente.ruc ?? "",
      cedula: cliente.cedula ?? "",
      email: cliente.email ?? "",
      tipoClienteId: cliente.tipoClienteId ?? null,
      categoriaPrecioId: cliente.categoriaPrecioId ?? null,
      estado: cliente.estado ?? "A",
      vip: cliente.vip ?? false,
      observaciones: cliente.observaciones ?? "",
      observacionesComerc: cliente.observacionesComerc ?? "",
    });
  }, [cliente.id, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBlur = useCallback(() => {
    const values = getValues();
    const dirty: Partial<ClienteFormValues> = {};
    for (const key of Object.keys(dirtyFields) as (keyof ClienteFormValues)[]) {
      if (dirtyFields[key]) {
        const v = values[key];
        (dirty as Record<string, unknown>)[key] = v === "" ? null : v;
      }
    }
    triggerAutosave(dirty);
  }, [dirtyFields, getValues, triggerAutosave]);

  const handleSelectSave = useCallback(
    (field: keyof ClienteFormValues, value: unknown) => {
      setValue(field, value as never, { shouldDirty: true });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        executeSave({ [field]: value } as Partial<ClienteFormValues>);
      }, 400);
    },
    [executeSave, setValue],
  );

  const tipoValue = watch("tipoClienteId");
  const categoriaValue = watch("categoriaPrecioId");
  const estadoValue = watch("estado");
  const vipValue = watch("vip");

  return (
    <div className="space-y-6 max-w-3xl">
      <div
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "text-xs transition-opacity duration-200",
          saveStatus === "idle" ? "opacity-0" : "opacity-100",
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
          <FormField label="Nombre" id="nombre" required error={errors.nombre?.message}>
            <Input id="nombre" {...register("nombre")} onBlur={handleBlur} aria-required="true" />
          </FormField>

          <FormField label="Email" id="email" error={errors.email?.message}>
            <Input id="email" type="email" {...register("email")} onBlur={handleBlur} />
          </FormField>

          <FormField label="RUC" id="ruc">
            <Input id="ruc" {...register("ruc")} onBlur={handleBlur} />
          </FormField>

          <FormField label="Cédula" id="cedula">
            <Input id="cedula" {...register("cedula")} onBlur={handleBlur} />
          </FormField>
        </div>
      </fieldset>

      {/* ── Clasificación ── */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Clasificación
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Tipo cliente" id="tipoClienteId">
            <Select
              value={tipoValue != null ? String(tipoValue) : NONE}
              onValueChange={(v) =>
                handleSelectSave("tipoClienteId", v === NONE ? null : Number(v))
              }
            >
              <SelectTrigger id="tipoClienteId">
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
          </FormField>

          <FormField label="Categoría precio" id="categoriaPrecioId">
            <Select
              value={categoriaValue != null ? String(categoriaValue) : NONE}
              onValueChange={(v) =>
                handleSelectSave("categoriaPrecioId", v === NONE ? null : Number(v))
              }
            >
              <SelectTrigger id="categoriaPrecioId">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Sin categoría —</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre ?? `Categoría ${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Estado" id="estado" required>
            <Select
              value={estadoValue ?? "A"}
              onValueChange={(v) => handleSelectSave("estado", v)}
            >
              <SelectTrigger id="estado">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Activo</SelectItem>
                <SelectItem value="I">Inactivo</SelectItem>
                <SelectItem value="P">Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="vip"
            checked={!!vipValue}
            onChange={(e) => handleSelectSave("vip", e.target.checked)}
            className="rounded border-border"
          />
          <Label htmlFor="vip" className="text-sm cursor-pointer">
            Cliente VIP
          </Label>
        </div>
      </fieldset>

      {/* ── Observaciones ── */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Observaciones
        </legend>
        <div className="space-y-4">
          <FormField label="Observaciones" id="observaciones">
            <textarea
              id="observaciones"
              {...register("observaciones")}
              onBlur={handleBlur}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </FormField>

          <FormField label="Obs. comercial" id="observacionesComerc">
            <textarea
              id="observacionesComerc"
              {...register("observacionesComerc")}
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
        {required && (
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive mt-0.5">
          {error}
        </p>
      )}
    </div>
  );
}
