"use client";

import type { PuestoDetalle } from "@/lib/types/puesto";
import PuestoMapPreview from "../PuestoMapPreview";
import { formatFecha, formatLatLng, formatNullable, mapBoolean } from "../helpers";

/** Fila label/valor. El valor va a la derecha, como en el diseño, y trunca sin
 *  romper el ancho del panel. */
function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm" title={value}>
        {value}
      </dd>
    </div>
  );
}

export default function PuestoInfoTab({ puesto }: { puesto: PuestoDetalle }) {
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-border/60">
        <Dato label="Departamento" value={formatNullable(puesto.departamentoNombre)} />
        <Dato label="Dirección" value={formatNullable(puesto.direccion)} />
        <Dato label="Localidad" value={formatNullable(puesto.localidadNombre)} />
        <Dato label="Teléfono" value={formatNullable(puesto.telefono)} />
        <Dato label="Email" value={formatNullable(puesto.mail)} />
        <Dato label="Propio" value={mapBoolean(puesto.propio)} />
        <Dato label="Auto pedido" value={mapBoolean(puesto.autopedido)} />
        <Dato label="Horarios" value={formatNullable(puesto.horarios)} />
        <Dato label="Flete cobra" value={mapBoolean(puesto.fleteCobra)} />
        <Dato label="Flete cantidad" value={formatNullable(puesto.fleteCantidad)} />
        <Dato label="Lat / Lng" value={formatLatLng(puesto.lat, puesto.lng)} />
        <Dato label="Últ. actualización" value={formatFecha(puesto.updatedAt)} />
      </dl>

      <PuestoMapPreview
        lat={puesto.lat}
        lng={puesto.lng}
        nombre={puesto.nombre}
        direccion={puesto.direccion}
      />
    </div>
  );
}
