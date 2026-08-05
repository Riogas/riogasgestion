"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SorteoFormValues } from "./helpers";

interface SorteoFormFieldsProps {
  register: UseFormRegister<SorteoFormValues>;
  errors: FieldErrors<SorteoFormValues>;
  /** Prefijo de los `id` para no duplicarlos cuando hay dos forms en la misma página. */
  idPrefix: string;
  disabled?: boolean;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function SorteoFormFields({
  register,
  errors,
  idPrefix,
  disabled = false,
}: SorteoFormFieldsProps) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={id("nombre")}>
          Nombre <span className="text-destructive">*</span>
        </Label>
        <Input
          id={id("nombre")}
          placeholder="Sorteo de verano 2026"
          aria-invalid={!!errors.nombre}
          disabled={disabled}
          {...register("nombre")}
        />
        <FieldError message={errors.nombre?.message} />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={id("descripcion")}>Descripción</Label>
        <Input
          id={id("descripcion")}
          placeholder="Texto interno de referencia (opcional)"
          aria-invalid={!!errors.descripcion}
          disabled={disabled}
          {...register("descripcion")}
        />
        <FieldError message={errors.descripcion?.message} />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={id("premioDescripcion")}>
          Premio <span className="text-destructive">*</span>
        </Label>
        <Input
          id={id("premioDescripcion")}
          placeholder="Garrafa de 13 kg sin cargo"
          aria-invalid={!!errors.premioDescripcion}
          disabled={disabled}
          {...register("premioDescripcion")}
        />
        <p className="text-xs text-muted-foreground">
          Es el texto que ve el participante cuando gana.
        </p>
        <FieldError message={errors.premioDescripcion?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("fechaDesde")}>
          Desde <span className="text-destructive">*</span>
        </Label>
        <Input
          id={id("fechaDesde")}
          type="datetime-local"
          aria-invalid={!!errors.fechaDesde}
          disabled={disabled}
          {...register("fechaDesde")}
        />
        <FieldError message={errors.fechaDesde?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("fechaHasta")}>
          Hasta <span className="text-destructive">*</span>
        </Label>
        <Input
          id={id("fechaHasta")}
          type="datetime-local"
          aria-invalid={!!errors.fechaHasta}
          disabled={disabled}
          {...register("fechaHasta")}
        />
        <FieldError message={errors.fechaHasta?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("cantidadPremios")}>
          Cantidad de premios <span className="text-destructive">*</span>
        </Label>
        <Input
          id={id("cantidadPremios")}
          type="number"
          min={1}
          max={100000}
          inputMode="numeric"
          className="tabular-nums"
          aria-invalid={!!errors.cantidadPremios}
          disabled={disabled}
          {...register("cantidadPremios")}
        />
        <FieldError message={errors.cantidadPremios?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("maxRegistrosDispositivoDia")}>
          Máx. registros por dispositivo/día <span className="text-destructive">*</span>
        </Label>
        <Input
          id={id("maxRegistrosDispositivoDia")}
          type="number"
          min={1}
          max={100}
          inputMode="numeric"
          className="tabular-nums"
          aria-invalid={!!errors.maxRegistrosDispositivoDia}
          disabled={disabled}
          {...register("maxRegistrosDispositivoDia")}
        />
        <FieldError message={errors.maxRegistrosDispositivoDia?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("edadMinima")}>
          Edad mínima <span className="text-destructive">*</span>
        </Label>
        <Input
          id={id("edadMinima")}
          type="number"
          min={1}
          max={120}
          inputMode="numeric"
          className="tabular-nums"
          aria-invalid={!!errors.edadMinima}
          disabled={disabled}
          {...register("edadMinima")}
        />
        <FieldError message={errors.edadMinima?.message} />
      </div>
    </div>
  );
}
