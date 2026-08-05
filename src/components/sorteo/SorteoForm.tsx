"use client";

// Formulario de participación del sorteo público. Mobile-first (los QR se
// escanean con el celular): inputs de 48px, labels reales, teclados
// semánticos (tel/numeric/email) y validación zod en español rioplatense.
// Incluye el honeypot `hp`: input de texto offscreen (JAMÁS display:none,
// algunos bots lo detectan) que un humano nunca ve ni completa.
import { zodResolver } from "@hookform/resolvers/zod";
import { CloudOff, Gift, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SorteoPublico } from "@/lib/sorteo/publicApi";

/** Celular (09 + 7 cifras) o fijo (2/4 + 7 cifras), ya normalizado. */
export const TELEFONO_UY_REGEX = /^(09\d{7}|[24]\d{7})$/;

/**
 * Deja solo dígitos, quita el prefijo internacional 598 (con o sin 00) y
 * repone el 0 inicial del celular si vino en formato internacional.
 */
export function normalizarTelefonoUy(valor: string): string {
  let digitos = valor.replace(/\D+/g, "");
  if (digitos.startsWith("00598") && digitos.length > 11) {
    digitos = digitos.slice(5);
  } else if (digitos.startsWith("598") && digitos.length > 9) {
    digitos = digitos.slice(3);
  }
  if (/^9\d{7}$/.test(digitos)) digitos = `0${digitos}`;
  return digitos;
}

function crearSchema(edadMinima: number) {
  return z.object({
    nombre: z.string().trim().min(3, "Escribí tu nombre y apellido"),
    telefono: z
      .string()
      .trim()
      .min(1, "Ingresá un teléfono para poder avisarte si ganás")
      .transform(normalizarTelefonoUy)
      .refine(
        (tel) => TELEFONO_UY_REGEX.test(tel),
        "Revisá el número: celular (099 123 456) o fijo de 8 cifras",
      ),
    edad: z
      .string()
      .trim()
      .min(1, "Ingresá tu edad")
      .refine((v) => /^\d+$/.test(v), "La edad va solo en números")
      .refine(
        (v) => !/^\d+$/.test(v) || Number(v) <= 120,
        "Revisá la edad ingresada",
      )
      .refine(
        (v) => !/^\d+$/.test(v) || Number(v) > 120 || Number(v) >= edadMinima,
        `Tenés que tener al menos ${edadMinima} años`,
      ),
    email: z.union([
      z.literal(""),
      z.email("Ese email no parece válido (ej: nombre@correo.com)"),
    ]),
    hp: z.string(),
  });
}

export type DatosParticipacion = {
  nombre: string;
  telefono: string;
  edad: number;
  email?: string;
  hp: string;
};

type Props = {
  sorteo: SorteoPublico;
  /** Error de envío (error_temporal): el form queda cargado para reintentar. */
  errorEnvio: string | null;
  onEnviar: (datos: DatosParticipacion) => Promise<void>;
};

export default function SorteoForm({ sorteo, errorEnvio, onEnviar }: Props) {
  const schema = useMemo(() => crearSchema(sorteo.edadMinima), [sorteo.edadMinima]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { nombre: "", telefono: "", edad: "", email: "", hp: "" },
  });

  const enviar = handleSubmit(async (valores) => {
    await onEnviar({
      nombre: valores.nombre,
      telefono: valores.telefono,
      edad: Number(valores.edad),
      email: valores.email || undefined,
      hp: valores.hp,
    });
  });

  return (
    <div className="px-6 pb-7 pt-7 sm:px-8">
      <header className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-primary">
          Sorteo
        </p>
        <h1 className="mt-1.5 text-[1.6rem] font-extrabold leading-tight tracking-tight text-card-foreground">
          {sorteo.nombre}
        </h1>
      </header>

      {/* Premio */}
      <div className="mt-5 flex items-center gap-3.5 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/[0.06] to-accent/[0.08] p-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[#FF9A4D] shadow-sm">
          <Gift className="h-6 w-6 text-white" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Premio
          </p>
          <p className="text-sm font-semibold leading-snug text-card-foreground">
            {sorteo.premioDescripcion}
          </p>
        </div>
      </div>

      <form onSubmit={enviar} noValidate className="relative mt-6 space-y-4">
        {/* Honeypot: offscreen absoluto, nunca display:none */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden"
        >
          <label htmlFor="sorteo-hp">Dejá este campo vacío</label>
          <input
            id="sorteo-hp"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...register("hp")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sorteo-nombre">
            Nombre y apellido <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sorteo-nombre"
            type="text"
            autoComplete="name"
            placeholder="Ej: María Rodríguez"
            className="h-12 rounded-xl text-base"
            aria-invalid={errors.nombre ? true : undefined}
            aria-describedby={errors.nombre ? "sorteo-nombre-error" : undefined}
            {...register("nombre")}
          />
          {errors.nombre && (
            <p
              id="sorteo-nombre-error"
              role="alert"
              className="text-sm font-medium text-destructive"
            >
              {errors.nombre.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sorteo-telefono">
            Celular <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sorteo-telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="099 123 456"
            className="h-12 rounded-xl text-base"
            aria-invalid={errors.telefono ? true : undefined}
            aria-describedby={
              errors.telefono ? "sorteo-telefono-error" : "sorteo-telefono-ayuda"
            }
            {...register("telefono")}
          />
          {errors.telefono ? (
            <p
              id="sorteo-telefono-error"
              role="alert"
              className="text-sm font-medium text-destructive"
            >
              {errors.telefono.message}
            </p>
          ) : (
            <p id="sorteo-telefono-ayuda" className="text-xs text-muted-foreground">
              Si ganás, te llamamos a este número.
            </p>
          )}
        </div>

        <div className="grid grid-cols-[7rem_1fr] gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="sorteo-edad">
              Edad <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sorteo-edad"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              placeholder={`${sorteo.edadMinima}+`}
              className="h-12 rounded-xl text-base"
              aria-invalid={errors.edad ? true : undefined}
              aria-describedby={errors.edad ? "sorteo-edad-error" : undefined}
              {...register("edad")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sorteo-email">
              Email <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="sorteo-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nombre@correo.com"
              className="h-12 rounded-xl text-base"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "sorteo-email-error" : undefined}
              {...register("email")}
            />
          </div>
        </div>
        {errors.edad && (
          <p
            id="sorteo-edad-error"
            role="alert"
            className="-mt-2 text-sm font-medium text-destructive"
          >
            {errors.edad.message}
          </p>
        )}
        {errors.email && (
          <p
            id="sorteo-email-error"
            role="alert"
            className="-mt-2 text-sm font-medium text-destructive"
          >
            {errors.email.message}
          </p>
        )}

        {errorEnvio && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3.5 text-sm font-medium leading-snug text-destructive"
          >
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <span>{errorEnvio}</span>
          </div>
        )}

        <Button
          type="submit"
          variant="accent"
          disabled={isSubmitting}
          className="!mt-6 h-14 w-full rounded-xl text-base font-semibold shadow-[0_10px_30px_-8px_rgba(255,122,26,0.55)]"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="size-5 animate-spin" aria-hidden />
              Enviando participación…
            </>
          ) : (
            <>
              <Sparkles className="size-5" aria-hidden />
              Participar del sorteo
            </>
          )}
        </Button>

        <p className="flex items-start gap-2 pt-1 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          Usamos tus datos únicamente para contactarte si ganás. No te mandamos
          publicidad.
        </p>
      </form>
    </div>
  );
}
