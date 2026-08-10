"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useActualizarPuesto, useCrearPuesto } from "@/hooks/puestos";
import type {
  ActualizarPuestoPayload,
  CrearPuestoPayload,
  DepartamentoOpcion,
  PuestoDetalle,
} from "@/lib/types/puesto";
import { flagABoolean, puestoFormSchema, type PuestoFormValues } from "./helpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = alta; con puesto = edición. */
  puesto: PuestoDetalle | null;
  departamentos: DepartamentoOpcion[];
  onGuardado: (id: number) => void;
}

const VACIOS: PuestoFormValues = {
  id: "",
  nombre: "",
  departamentoId: "",
  direccion: "",
  zonaId: "",
  mail: "",
  telefono: "",
  propio: false,
  autopedido: false,
  fleteCobra: false,
  fleteCantidad: "",
  horarios: "",
  lat: "",
  lng: "",
  estado: "A",
};

function valoresDesde(p: PuestoDetalle): PuestoFormValues {
  return {
    id: String(p.id),
    nombre: p.nombre ?? "",
    departamentoId: p.departamentoId ? String(p.departamentoId) : "",
    direccion: p.direccion ?? "",
    zonaId: p.zonaId ? String(p.zonaId) : "",
    mail: p.mail ?? "",
    telefono: p.telefono ?? "",
    propio: flagABoolean(p.propio),
    autopedido: flagABoolean(p.autopedido),
    fleteCobra: flagABoolean(p.fleteCobra),
    fleteCantidad: p.fleteCantidad ?? "",
    horarios: p.horarios ?? "",
    lat: p.lat != null ? String(p.lat) : "",
    lng: p.lng != null ? String(p.lng) : "",
    estado: (p.estado === "P" ? "P" : "A") as "A" | "P",
  };
}

/** Los opcionales vacíos se omiten: mandar "" chocaría con @IsEmail y demás. */
function limpiar<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== "" && !(typeof v === "number" && Number.isNaN(v))) {
      out[k] = v;
    }
  }
  return out as T;
}

export default function PuestoFormDrawer({
  open,
  onOpenChange,
  puesto,
  departamentos,
  onGuardado,
}: Props) {
  const edicion = puesto !== null;
  const crear = useCrearPuesto();
  const actualizar = useActualizarPuesto();
  const guardando = crear.isPending || actualizar.isPending;

  const form = useForm<PuestoFormValues>({
    resolver: zodResolver(puestoFormSchema),
    defaultValues: VACIOS,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = form;

  // Repoblar cada vez que se abre: el mismo drawer sirve para alta y edición.
  useEffect(() => {
    if (!open) return;
    reset(puesto ? valoresDesde(puesto) : VACIOS);
  }, [open, puesto, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const comunes = limpiar({
      nombre: v.nombre,
      departamentoId: Number(v.departamentoId),
      direccion: v.direccion,
      zonaId: v.zonaId ? Number(v.zonaId) : undefined,
      mail: v.mail,
      telefono: v.telefono,
      propio: (v.propio ? "S" : "N") as "S" | "N",
      autopedido: (v.autopedido ? "S" : "N") as "S" | "N",
      fleteCobra: (v.fleteCobra ? "S" : "N") as "S" | "N",
      fleteCantidad: v.fleteCantidad,
      horarios: v.horarios,
      lat: v.lat ? Number(v.lat) : undefined,
      lng: v.lng ? Number(v.lng) : undefined,
      estado: v.estado,
    });

    try {
      if (edicion && puesto) {
        await actualizar.mutateAsync({
          id: puesto.id,
          payload: comunes as ActualizarPuestoPayload,
        });
        onGuardado(puesto.id);
      } else {
        const id = Number(v.id);
        await crear.mutateAsync({ ...comunes, id } as CrearPuestoPayload);
        onGuardado(id);
      }
      onOpenChange(false);
    } catch {
      // El toast con el mensaje del backend ya lo emite el hook de mutación.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{edicion ? "Editar puesto" : "Nuevo puesto"}</DialogTitle>
          <DialogDescription>
            {edicion
              ? "Modificá los datos del puesto de venta."
              : "Cargá un puesto de venta de garrafas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="ID"
              error={errors.id?.message}
              hint={edicion ? undefined : "El id lo define el sistema legado; no es correlativo."}
            >
              <Input
                {...register("id")}
                disabled={edicion}
                inputMode="numeric"
                placeholder="Ej: 101"
              />
            </Campo>

            <Campo label="Nombre *" error={errors.nombre?.message}>
              <Input {...register("nombre")} placeholder="Ej: Montevideo" maxLength={40} />
            </Campo>

            <Campo label="Departamento *" error={errors.departamentoId?.message}>
              <Select
                value={watch("departamentoId")}
                onValueChange={(v) => setValue("departamentoId", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí un departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.nombre ?? `Departamento ${d.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo label="Estado" error={errors.estado?.message}>
              <Select
                value={watch("estado")}
                onValueChange={(v) => setValue("estado", v as "A" | "P", { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Activo</SelectItem>
                  <SelectItem value="P">Pasivo</SelectItem>
                </SelectContent>
              </Select>
            </Campo>

            <Campo label="Dirección" error={errors.direccion?.message} className="sm:col-span-2">
              <Input
                {...register("direccion")}
                placeholder="Ej: Av. 8 de Octubre 5400"
                maxLength={100}
              />
            </Campo>

            <Campo label="Email" error={errors.mail?.message}>
              <Input {...register("mail")} placeholder="puesto@riogas.com.uy" />
            </Campo>

            <Campo label="Teléfono" error={errors.telefono?.message}>
              <Input {...register("telefono")} placeholder="Ej: 22223838" maxLength={20} />
            </Campo>

            <Campo label="Zona (id legacy)" error={errors.zonaId?.message}>
              <Input {...register("zonaId")} inputMode="numeric" placeholder="Opcional" />
            </Campo>

            <Campo label="Flete cantidad" error={errors.fleteCantidad?.message}>
              <Input {...register("fleteCantidad")} maxLength={2} placeholder="Ej: 2" />
            </Campo>

            <Campo label="Latitud" error={errors.lat?.message}>
              <Input {...register("lat")} inputMode="decimal" placeholder="-34.9011" />
            </Campo>

            <Campo label="Longitud" error={errors.lng?.message}>
              <Input {...register("lng")} inputMode="decimal" placeholder="-56.1645" />
            </Campo>

            <Campo label="Horarios" error={errors.horarios?.message} className="sm:col-span-2">
              <Input
                {...register("horarios")}
                placeholder="Ej: Lun a Dom 08:00 - 20:00"
                maxLength={200}
              />
            </Campo>
          </div>

          <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
            <Interruptor
              id="propio"
              label="Propio"
              checked={watch("propio")}
              onChange={(v) => setValue("propio", v)}
            />
            <Interruptor
              id="autopedido"
              label="Auto pedido"
              checked={watch("autopedido")}
              onChange={(v) => setValue("autopedido", v)}
            />
            <Interruptor
              id="fleteCobra"
              label="Flete cobra"
              checked={watch("fleteCobra")}
              onChange={(v) => setValue("fleteCobra", v)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando} className="gap-2">
              <Save className="size-4" />
              {edicion ? "Guardar cambios" : "Guardar puesto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Interruptor({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
