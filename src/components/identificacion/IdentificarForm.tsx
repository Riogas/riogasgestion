"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, IdCard, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useIdentificar } from "@/hooks/identificacion/useIdentificar";
import type { IdentificarParams, IdentificarResultado } from "@/lib/types/persona";

const TIPOS: { value: IdentificarParams["tipo"]; label: string; icon: typeof IdCard }[] = [
  { value: "CEDULA", label: "Cédula", icon: IdCard },
  { value: "TELEFONO", label: "Teléfono", icon: Phone },
];

interface IdentificarFormProps {
  /** Se llama con el resultado de la mutación (o `null` al iniciar una nueva búsqueda). */
  onResult: (resultado: IdentificarResultado | null) => void;
}

/**
 * Form de identificación del distribuidor — sólo envía `{identificador, tipo}`.
 * El backend deriva rol/afiliación del token; el front nunca manda rol.
 */
export function IdentificarForm({ onResult }: IdentificarFormProps) {
  const [tipo, setTipo] = useState<IdentificarParams["tipo"]>("CEDULA");
  const [identificador, setIdentificador] = useState("");
  const [touched, setTouched] = useState(false);
  const identificar = useIdentificar();

  const isEmpty = identificador.trim().length === 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (isEmpty) return;

    onResult(null);
    identificar.mutate(
      { identificador: identificador.trim(), tipo },
      {
        onSuccess: (data) => onResult(data),
        onError: () => toast.error("Error al identificar. Intentá de nuevo."),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label id="tipo-identificador-label">Tipo de identificador</Label>
        <div
          role="radiogroup"
          aria-labelledby="tipo-identificador-label"
          className="inline-flex rounded-[var(--radius-md)] border border-border bg-muted/40 p-1"
        >
          {TIPOS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={tipo === value}
              onClick={() => setTipo(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
                tipo === value
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="identificador-input">
          {tipo === "CEDULA" ? "Cédula" : "Teléfono"} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="identificador-input"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
          placeholder={tipo === "CEDULA" ? "Ej: 12345678" : "Ej: 099123456"}
          aria-invalid={touched && isEmpty}
          className="max-w-xs"
        />
        {touched && isEmpty && (
          <p className="text-xs text-destructive">
            Ingresá {tipo === "CEDULA" ? "una cédula" : "un teléfono"}
          </p>
        )}
      </div>

      <Button type="submit" disabled={identificar.isPending} className="gap-2">
        {identificar.isPending && <Loader2 className="size-4 animate-spin" />}
        Identificar
      </Button>
    </form>
  );
}
