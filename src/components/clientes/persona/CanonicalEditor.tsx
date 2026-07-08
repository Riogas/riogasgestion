"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePersonaMutations } from "@/hooks/personas";
import type { Persona, SetCanonicalParams } from "@/lib/types/persona";
import type { ClienteDireccion, ClienteTelefono } from "@/lib/types/cliente";

const NONE = "__none__";

const canonicalSchema = z.object({
  nombreOficial: z.string().max(100, "Máximo 100 caracteres"),
  cedula: z.string().max(12, "Máximo 12 caracteres"),
  telefonoPrincipalId: z.string(),
  direccionPrincipalId: z.string(),
});

type CanonicalFormValues = z.infer<typeof canonicalSchema>;

interface CanonicalEditorProps {
  persona: Persona;
  telefonos: ClienteTelefono[];
  direcciones: ClienteDireccion[];
}

function defaultValuesFor(persona: Persona): CanonicalFormValues {
  return {
    nombreOficial: persona.nombreOficial ?? "",
    cedula: persona.cedula ?? "",
    telefonoPrincipalId:
      persona.telefonoPrincipalId != null ? String(persona.telefonoPrincipalId) : NONE,
    direccionPrincipalId:
      persona.direccionPrincipalId != null ? String(persona.direccionPrincipalId) : NONE,
  };
}

function direccionLabel(dir: ClienteDireccion): string {
  return (
    dir.direccion ?? ([dir.calle, dir.nro].filter(Boolean).join(" ") || `Dirección #${dir.id}`)
  );
}

export function CanonicalEditor({
  persona,
  telefonos,
  direcciones,
}: CanonicalEditorProps) {
  const { setCanonical } = usePersonaMutations(persona.id);
  const [cedulaError, setCedulaError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<CanonicalFormValues>({
    resolver: zodResolver(canonicalSchema),
    defaultValues: defaultValuesFor(persona),
  });

  useEffect(() => {
    reset(defaultValuesFor(persona));
    setCedulaError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona.id]);

  const telefonoValue = watch("telefonoPrincipalId");
  const direccionValue = watch("direccionPrincipalId");

  const onSubmit = (values: CanonicalFormValues) => {
    const dto: SetCanonicalParams = {};

    if (dirtyFields.nombreOficial && values.nombreOficial.trim()) {
      dto.nombreOficial = values.nombreOficial.trim();
    }
    if (dirtyFields.cedula && values.cedula.trim()) {
      dto.cedula = values.cedula.trim();
    }
    if (dirtyFields.telefonoPrincipalId && values.telefonoPrincipalId !== NONE) {
      dto.telefonoPrincipalId = Number(values.telefonoPrincipalId);
    }
    if (dirtyFields.direccionPrincipalId && values.direccionPrincipalId !== NONE) {
      dto.direccionPrincipalId = Number(values.direccionPrincipalId);
    }

    if (Object.keys(dto).length === 0) return;

    setCedulaError(null);
    setCanonical.mutate(dto, {
      onSuccess: () => reset(values),
      onError: (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          setCedulaError("La cédula ya está asignada a otra persona");
        }
      },
    });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Datos canónicos
      </h2>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-lg border border-border p-4 max-w-2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="nombreOficial">Nombre oficial</Label>
            <Input id="nombreOficial" {...register("nombreOficial")} />
            {errors.nombreOficial && (
              <p className="text-xs text-destructive">{errors.nombreOficial.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="cedula">Cédula</Label>
            <Input id="cedula" {...register("cedula")} />
            {errors.cedula && (
              <p className="text-xs text-destructive">{errors.cedula.message}</p>
            )}
            {cedulaError && <p className="text-xs text-destructive">{cedulaError}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="telefonoPrincipalId">Teléfono principal</Label>
            <Select
              value={telefonoValue}
              onValueChange={(v) => setValue("telefonoPrincipalId", v, { shouldDirty: true })}
            >
              <SelectTrigger id="telefonoPrincipalId" className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Sin definir —</SelectItem>
                {telefonos.map((tel) => (
                  <SelectItem key={tel.id} value={String(tel.id)}>
                    {tel.numero}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="direccionPrincipalId">Dirección principal</Label>
            <Select
              value={direccionValue}
              onValueChange={(v) => setValue("direccionPrincipalId", v, { shouldDirty: true })}
            >
              <SelectTrigger id="direccionPrincipalId" className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Sin definir —</SelectItem>
                {direcciones.map((dir) => (
                  <SelectItem key={dir.id} value={String(dir.id)}>
                    {direccionLabel(dir)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || setCanonical.isPending}>
            {setCanonical.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </section>
  );
}
