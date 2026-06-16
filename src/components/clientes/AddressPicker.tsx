"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiGetCapaGoya, apiGetCalles } from "@/services/api";
import { GenexusFeatureCollectionToGeoJson } from "@/lib/convertirGeoJson";
import { getPuestoActual, puntoEnZona } from "@/lib/geo";
import type { ZonaResult } from "@/lib/geo";
import type { ClienteDireccion } from "@/lib/types/cliente";
import type { FeatureCollection } from "geojson";

// ─── Dynamic map import (no SSR) ────────────────────────────────────────────

const DynamicMapa = dynamic(
  () => import("@/components/mapa/OpenStreetMap"),
  { ssr: false }
);

// ─── Static data ─────────────────────────────────────────────────────────────
// TODO(fase6): Replace with dynamic apiGetDepartamentos / apiGetLocalidades.
// OSMDepartamentoId / OSMLocalidadId values must match backend OSM import IDs.
const DEPARTAMENTOS = [
  { nombre: "Montevideo", id: 1, localidades: [{ nombre: "Centro", id: 1 }, { nombre: "Ciudad Vieja", id: 2 }, { nombre: "Pocitos", id: 3 }] },
  { nombre: "Canelones", id: 2, localidades: [{ nombre: "Las Piedras", id: 1 }, { nombre: "La Paz", id: 2 }, { nombre: "Barros Blancos", id: 3 }] },
  { nombre: "Maldonado", id: 3, localidades: [{ nombre: "Punta del Este", id: 1 }, { nombre: "San Carlos", id: 2 }, { nombre: "La Barra", id: 3 }] },
  { nombre: "Salto", id: 4, localidades: [{ nombre: "Salto", id: 1 }] },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AddressPickerValue = Partial<
  Pick<
    ClienteDireccion,
    "calle" | "nroPuerta" | "esquina1" | "esquina2" | "apto" | "local" | "lat" | "lng" | "zona"
  >
> & {
  departamento?: string;
  localidad?: string;
};

export interface AddressPickerProps {
  value: AddressPickerValue;
  onChange: (patch: Partial<AddressPickerValue>) => void;
  onZonaChange?: (result: ZonaResult) => void;
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddressPicker({
  value,
  onChange,
  onZonaChange,
  className,
}: AddressPickerProps) {
  const baseId = useId();
  const listId = `${baseId}-calles`;

  const [calles, setCalles] = useState<string[]>([]);
  const [capasGeoJson, setCapasGeoJson] = useState<FeatureCollection[]>([]);
  const [zonaResult, setZonaResult] = useState<ZonaResult | null>(null);

  // Stable refs for callbacks to avoid re-triggering zone effect on every render
  const onZonaChangeRef = useRef(onZonaChange);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onZonaChangeRef.current = onZonaChange;
    onChangeRef.current = onChange;
  });

  // ── Load zone layers on mount ──────────────────────────────────────────────
  useEffect(() => {
    const puesto = getPuestoActual();
    if (!puesto?.puestoId) return;

    apiGetCapaGoya({ PuestoId: String(puesto.puestoId), TipoCapaId: "" })
      .then((data) => {
        const capasArr: any[] = data?.sdtCapasGoya ?? [];
        const geojsons = capasArr
          .map((capa: any) => {
            try {
              const parsed =
                typeof capa.CapaGeoJson === "string"
                  ? JSON.parse(capa.CapaGeoJson)
                  : capa.CapaGeoJson;
              if (parsed?.type === "FeatureCollection") {
                return GenexusFeatureCollectionToGeoJson(parsed) as FeatureCollection;
              }
            } catch {
              // malformed — skip
            }
            return null;
          })
          .filter((fc): fc is FeatureCollection => fc !== null);
        setCapasGeoJson(geojsons);
      })
      .catch(() => setCapasGeoJson([]));
  }, []);

  // ── Load streets when dep/loc change ──────────────────────────────────────
  useEffect(() => {
    if (!value.departamento || !value.localidad) {
      setCalles([]);
      return;
    }

    const dep = DEPARTAMENTOS.find((d) => d.nombre === value.departamento);
    if (!dep) { setCalles([]); return; }

    const loc = dep.localidades.find((l) => l.nombre === value.localidad);
    if (!loc) { setCalles([]); return; }

    apiGetCalles({ DepartamentoId: dep.id, LocalidadId: loc.id })
      .then((data) => {
        const raw: unknown[] = data?.sdtCalles ?? [];
        const nombres = (raw as { CalleNombre?: string }[])
          .map((c) => c.CalleNombre ?? "")
          .filter(Boolean);
        setCalles(nombres);
      })
      .catch(() => setCalles([]));
  }, [value.departamento, value.localidad]);

  // ── Zone check when coords change ─────────────────────────────────────────
  useEffect(() => {
    const lat = value.lat;
    const lng = value.lng;

    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setZonaResult(null);
      return;
    }

    if (capasGeoJson.length === 0) return;

    const result = puntoEnZona(lat, lng, capasGeoJson);
    setZonaResult(result);
    // Emit zona name via onChange so parent value stays in sync
    onChangeRef.current({ zona: result.zona ?? undefined });
    onZonaChangeRef.current?.(result);
  }, [value.lat, value.lng, capasGeoJson]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDepartamentoChange = (v: string) => {
    onChange({ departamento: v, localidad: undefined, calle: undefined });
  };

  const handleLocalidadChange = (v: string) => {
    onChange({ localidad: v, calle: undefined });
  };

  const handleMapChange = (data: {
    lat: string;
    lng: string;
    address?: string;
    houseNumber?: string;
  }) => {
    const patch: Partial<AddressPickerValue> = {};
    if (data.address) patch.calle = data.address;
    if (data.houseNumber) patch.nroPuerta = data.houseNumber;
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      patch.lat = lat;
      patch.lng = lng;
    }
    onChange(patch);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const localidades =
    DEPARTAMENTOS.find((d) => d.nombre === value.departamento)?.localidades ?? ([] as const);

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-3", className)}>
      {/* ── Form fields ── */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">

        {/* Departamento */}
        <div className="md:col-span-3">
          <Label htmlFor={`${baseId}-departamento`} className="text-xs">
            Departamento
          </Label>
          <Select
            value={value.departamento ?? ""}
            onValueChange={handleDepartamentoChange}
          >
            <SelectTrigger id={`${baseId}-departamento`} className="w-full h-8 text-xs">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTAMENTOS.map((d) => (
                <SelectItem key={d.nombre} value={d.nombre}>
                  {d.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Localidad */}
        <div className="md:col-span-3">
          <Label htmlFor={`${baseId}-localidad`} className="text-xs">
            Localidad
          </Label>
          <Select
            value={value.localidad ?? ""}
            onValueChange={handleLocalidadChange}
            disabled={!value.departamento}
          >
            <SelectTrigger id={`${baseId}-localidad`} className="w-full h-8 text-xs">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {localidades.map((l) => (
                <SelectItem key={l.nombre} value={l.nombre}>
                  {l.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Calle con datalist */}
        <div className="col-span-full">
          <Label htmlFor={`${baseId}-calle`} className="text-xs">
            Calle
          </Label>
          <Input
            id={`${baseId}-calle`}
            className="h-8 text-xs"
            placeholder="Ej: Av. Italia"
            list={listId}
            value={value.calle ?? ""}
            onChange={(e) => onChange({ calle: e.target.value })}
          />
          <datalist id={listId}>
            {calles.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        {/* Nº Puerta / Esquina 1 / Esquina 2 */}
        <div className="md:col-span-2">
          <Label htmlFor={`${baseId}-nroPuerta`} className="text-xs">
            Nº Puerta
          </Label>
          <Input
            id={`${baseId}-nroPuerta`}
            className="h-8 text-xs"
            value={value.nroPuerta ?? ""}
            onChange={(e) => onChange({ nroPuerta: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor={`${baseId}-esquina1`} className="text-xs">
            Esquina 1
          </Label>
          <Input
            id={`${baseId}-esquina1`}
            className="h-8 text-xs"
            value={value.esquina1 ?? ""}
            onChange={(e) => onChange({ esquina1: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor={`${baseId}-esquina2`} className="text-xs">
            Esquina 2
          </Label>
          <Input
            id={`${baseId}-esquina2`}
            className="h-8 text-xs"
            value={value.esquina2 ?? ""}
            onChange={(e) => onChange({ esquina2: e.target.value })}
          />
        </div>

        {/* Apto / Local — SEPARATE FIELDS */}
        <div className="md:col-span-3">
          <Label htmlFor={`${baseId}-apto`} className="text-xs">
            Apto
          </Label>
          <Input
            id={`${baseId}-apto`}
            className="h-8 text-xs"
            value={value.apto ?? ""}
            onChange={(e) => onChange({ apto: e.target.value })}
          />
        </div>
        <div className="md:col-span-3">
          <Label htmlFor={`${baseId}-local`} className="text-xs">
            Local
          </Label>
          <Input
            id={`${baseId}-local`}
            className="h-8 text-xs"
            value={value.local ?? ""}
            onChange={(e) => onChange({ local: e.target.value })}
          />
        </div>

        {/* Latitud / Longitud (readOnly) */}
        <div className="md:col-span-3">
          <Label htmlFor={`${baseId}-lat`} className="text-xs">
            Latitud
          </Label>
          <Input
            id={`${baseId}-lat`}
            className="h-8 text-xs"
            readOnly
            value={value.lat != null ? String(value.lat) : ""}
          />
        </div>
        <div className="md:col-span-3">
          <Label htmlFor={`${baseId}-lng`} className="text-xs">
            Longitud
          </Label>
          <Input
            id={`${baseId}-lng`}
            className="h-8 text-xs"
            readOnly
            value={value.lng != null ? String(value.lng) : ""}
          />
        </div>

        {/* Zone indicator badge — always rendered for aria-live to work */}
        <div className="col-span-full" aria-live="polite">
          {zonaResult !== null && (
            <span
              className={cn(
                "inline-block rounded px-2 py-0.5 text-xs font-medium",
                zonaResult.enZona
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              )}
            >
              {zonaResult.enZona
                ? `✓ En zona${zonaResult.zona ? " " + zonaResult.zona : ""}`
                : "⚠ Fuera de zona"}
            </span>
          )}
        </div>
      </div>

      {/* ── Map ── */}
      <div>
        <DynamicMapa
          onChange={handleMapChange}
          departamento={value.departamento}
          localidad={value.localidad}
          direccion={value.calle ?? ""}
          nroPuerta={value.nroPuerta ?? ""}
          esquina1={value.esquina1 ?? ""}
          esquina2={value.esquina2 ?? ""}
          zonas={capasGeoJson}
          mapHeightPx={520}
        />
      </div>
    </div>
  );
}
