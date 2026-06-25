"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMovilCatalogos, useMovilMutations } from "@/hooks/moviles";
import type { MovilDetalle, UpdateMovilPayload } from "@/lib/types/movil";
import { Field, SelectField, SwitchRow, TextareaField } from "./fields";
import {
  ProductosTabla,
  PuntosTabla,
  ServiciosTabla,
  EscenariosTabla,
} from "./SubrecursoTablas";

type Draft = UpdateMovilPayload;

function isoDate(v: string | null | undefined): string {
  if (!v) return "";
  return v.slice(0, 10);
}

export function ConfiguracionTab({
  movil,
  draft,
  setDraft,
  mut,
}: {
  movil: MovilDetalle;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  mut: ReturnType<typeof useMovilMutations>;
}) {
  const { data: catalogos } = useMovilCatalogos();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // valor efectivo = draft override ?? valor del móvil
  const v = <K extends keyof MovilDetalle>(key: K, dkey: keyof Draft) => {
    const dv = draft[dkey];
    return dv !== undefined ? dv : (movil[key] as unknown);
  };

  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const fleteraOpts = [
    { value: "", label: "— Sin fletera —" },
    ...(catalogos?.fleteras ?? []).map((f) => ({
      value: String(f.id),
      label: f.nombre ?? `#${f.id}`,
    })),
  ];
  const estadoOpts = [
    { value: "", label: "—" },
    ...(catalogos?.estados ?? []).map((e) => ({
      value: String(e.codigo),
      label: e.nombre,
    })),
  ];
  const servicioOpts = [
    { value: "", label: "—" },
    ...(catalogos?.servicios ?? [])
      .filter((s) => s.nombre)
      .map((s) => ({ value: s.nombre!, label: s.nombre! })),
  ];
  const calleOpts = [
    { value: "", label: "— Sin calle —" },
    ...(catalogos?.calles ?? []).map((c) => ({
      value: String(c.id),
      label: c.nombre ?? `#${c.id}`,
    })),
  ];
  const reasignOpts = [
    { value: "", label: "—" },
    { value: "S", label: "Sí" },
    { value: "N", label: "No" },
  ];
  const bajaOpts = [
    { value: "", label: "—" },
    { value: "true", label: "Permitida" },
    { value: "false", label: "No permitida" },
  ];

  return (
    <div className="space-y-5">
      {/* Secciones 1 + 2 en dos columnas */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Sección 1: Datos generales */}
        <Card className="gap-4 px-5">
          <SeccionTitulo n={1} titulo="Datos generales" />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Descripción"
              value={v("descripcion", "descripcion") as string}
              onChange={(val) => set("descripcion", val)}
              className="col-span-2"
            />
            <Field label="Móvil" value={movil.numero} readOnly />
            <Field
              label="Matrícula"
              value={v("matricula", "matricula") as string}
              onChange={(val) => set("matricula", val)}
            />
            <SelectField
              label="Fletera"
              value={String((v("fleteraId", "fleteraId") as number) ?? "")}
              onChange={(val) => set("fleteraId", val ? Number(val) : null)}
              options={fleteraOpts}
              className="col-span-2"
            />
            <Field
              label="Marca"
              value={v("marca", "marca") as string}
              onChange={(val) => set("marca", val)}
            />
            <Field
              label="Modelo"
              value={v("modelo", "modelo") as string}
              onChange={(val) => set("modelo", val)}
            />
            <SelectField
              label="Servicio"
              value={String((v("tipoServicio", "tipoServicio") as string) ?? "")}
              onChange={(val) => set("tipoServicio", val || null)}
              options={servicioOpts}
            />
            <Field
              label="Cap. bodega / lote"
              type="number"
              value={v("capacidadLote", "capacidadLote") as number}
              onChange={(val) => set("capacidadLote", num(val))}
            />
            <SelectField
              label="Estado"
              value={String((v("estadoCodigo", "estadoCodigo") as number) ?? "")}
              onChange={(val) => set("estadoCodigo", val ? Number(val) : null)}
              options={estadoOpts}
            />
            <Field
              label="# Pedidos pendientes"
              type="number"
              value={v("pedidosPendientes", "pedidosPendientes") as number}
              onChange={(val) => set("pedidosPendientes", num(val))}
            />
            <Field
              label="Teléfono"
              value={v("telefono", "telefono") as string}
              onChange={(val) => set("telefono", val)}
            />
            <Field
              label="Dir SMS"
              value={v("dirSms", "dirSms") as string}
              onChange={(val) => set("dirSms", val)}
            />
            <Field
              label="En Riogas desde"
              type="date"
              value={isoDate(v("activoDesde", "activoDesde") as string)}
              onChange={(val) => set("activoDesde", val || null)}
            />
            <Field
              label="En Riogas hasta"
              type="date"
              value={isoDate(v("activoHasta", "activoHasta") as string)}
              onChange={(val) => set("activoHasta", val || null)}
            />
            <TextareaField
              label="Observaciones"
              value={v("observaciones", "observaciones") as string}
              onChange={(val) => set("observaciones", val)}
              className="col-span-2"
            />
          </div>
        </Card>

        {/* Sección 2: Ruteo y comportamiento */}
        <Card className="gap-4 px-5">
          <SeccionTitulo n={2} titulo="Ruteo y comportamiento" />
          <div className="grid grid-cols-1 gap-2.5">
            <SwitchRow
              label="Usado por ruteo"
              checked={Boolean(v("rutea", "rutea"))}
              onChange={(c) => set("rutea", c)}
            />
            <SwitchRow
              label="Enviar pedidos al celular"
              checked={Boolean(v("enviarPedidosCelular", "enviarPedidosCelular"))}
              onChange={(c) => set("enviarPedidosCelular", c)}
            />
            <SwitchRow
              label="Actualizar coordenadas c/30s"
              checked={Boolean(v("actualizarCoord30s", "actualizarCoord30s"))}
              onChange={(c) => set("actualizarCoord30s", c)}
            />
            <SwitchRow
              label="Ruta ICA"
              checked={Boolean(v("usaIca", "usaIca"))}
              onChange={(c) => set("usaIca", c)}
            />
            <SwitchRow
              label="Mostrar en mapa"
              checked={Boolean(v("mostrarEnMapa", "mostrarEnMapa"))}
              onChange={(c) => set("mostrarEnMapa", c)}
            />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Reasignación de puesto"
              value={String((v("reasignacionPuesto", "reasignacionPuesto") as string) ?? "")}
              onChange={(val) => set("reasignacionPuesto", val || null)}
              options={reasignOpts}
            />
            <Field
              label="Activar por dirección · Nº"
              type="number"
              value={v("activarDireccionNro", "activarDireccionNro") as number}
              onChange={(val) => set("activarDireccionNro", num(val))}
            />
            <SelectField
              label="Activar por dirección · Calle"
              value={String((v("activarDireccionCalleId", "activarDireccionCalleId") as number) ?? "")}
              onChange={(val) => set("activarDireccionCalleId", val ? Number(val) : null)}
              options={calleOpts}
              className="col-span-2"
            />
            <Field
              label="Coord activa X"
              type="number"
              value={v("coordActivaX", "coordActivaX") as number}
              onChange={(val) => set("coordActivaX", num(val))}
            />
            <Field
              label="Coord activa Y"
              type="number"
              value={v("coordActivaY", "coordActivaY") as number}
              onChange={(val) => set("coordActivaY", num(val))}
            />
            <Field
              label="Tiempo cumplimiento servicio"
              type="number"
              value={v("tiempoCumplimientoServicio", "tiempoCumplimientoServicio") as number}
              onChange={(val) => set("tiempoCumplimientoServicio", num(val))}
            />
            <Field
              label="Radio mín ICA (m)"
              type="number"
              value={v("radioMinIcaMetros", "radioMinIcaMetros") as number}
              onChange={(val) => set("radioMinIcaMetros", num(val))}
            />
            <Field
              label="Finalización rutas 1"
              type="number"
              value={v("finalizacionRutas1", "finalizacionRutas1") as number}
              onChange={(val) => set("finalizacionRutas1", num(val))}
            />
            <Field
              label="Finalización rutas 2"
              type="number"
              value={v("finalizacionRutas2", "finalizacionRutas2") as number}
              onChange={(val) => set("finalizacionRutas2", num(val))}
            />
          </div>
        </Card>
      </div>

      {/* Sección 3: Operación en app (full width) */}
      <Card className="gap-4 px-5">
        <SeccionTitulo n={3} titulo="Operación en app" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SwitchRow
            label="Activar por app"
            checked={Boolean(v("activarPorApp", "activarPorApp"))}
            onChange={(c) => set("activarPorApp", c)}
          />
          <SwitchRow
            label="Desactivar por app"
            checked={Boolean(v("appPuedeDesactivar", "appPuedeDesactivar"))}
            onChange={(c) => set("appPuedeDesactivar", c)}
          />
          <SwitchRow
            label="Captura de pantalla"
            checked={Boolean(v("capturaPantalla", "capturaPantalla"))}
            onChange={(c) => set("capturaPantalla", c)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <SelectField
            label="Grabar pantalla"
            value={boolStr(v("grabarPantalla", "grabarPantalla"))}
            onChange={(val) => set("grabarPantalla", val === "" ? undefined : val === "true")}
            options={[
              { value: "", label: "—" },
              { value: "true", label: "Sí" },
              { value: "false", label: "No" },
            ]}
          />
          <SelectField
            label="Debug delivery"
            value={boolStr(v("debugDelivery", "debugDelivery"))}
            onChange={(val) => set("debugDelivery", val === "" ? undefined : val === "true")}
            options={[
              { value: "", label: "—" },
              { value: "true", label: "Sí" },
              { value: "false", label: "No" },
            ]}
          />
          <SelectField
            label="Baja momentánea"
            value={boolStr(v("permiteBajaMomentanea", "permiteBajaMomentanea"))}
            onChange={(val) =>
              set("permiteBajaMomentanea", val === "" ? undefined : val === "true")
            }
            options={bajaOpts}
          />
          <Field
            label="Distancia máx (m)"
            type="number"
            value={v("distanciaMaxMetros", "distanciaMaxMetros") as number}
            onChange={(val) => set("distanciaMaxMetros", num(val))}
          />
        </div>
      </Card>

      {/* Sección 4: Recarga y productos (full width) */}
      <ProductosTabla movil={movil} mut={mut} />

      {/* Secciones 5/6/7 en tres columnas */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <PuntosTabla movil={movil} mut={mut} />
        <ServiciosTabla movil={movil} mut={mut} />
        <EscenariosTabla movil={movil} mut={mut} />
      </div>
    </div>
  );
}

function SeccionTitulo({ n, titulo }: { n: number; titulo: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
        {n}
      </span>
      <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
    </div>
  );
}

function boolStr(v: unknown): string {
  if (v === true) return "true";
  if (v === false) return "false";
  return "";
}
