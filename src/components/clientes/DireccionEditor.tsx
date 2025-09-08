"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { point as turfPoint } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { toast } from "sonner";
import { apiGetCapaGoya } from "@/services/api";
import { GenexusFeatureCollectionToGeoJson } from "@/lib/convertirGeoJson";

const DynamicMapa = dynamic(() => import("@/components/mapa/OpenStreetMap"), { ssr: false });

export type Direccion = {
  departamento?: string;
  localidad?: string;
  calle?: string;
  nroPuerta?: string;
  esquina1?: string;
  esquina2?: string;
  block?: string;
  nivel?: string;
  local?: string;
  manzana?: string;
  lat?: string;
  lng?: string;
  zonaId?: string;
};

const departamentos = [
  { nombre: "Montevideo", localidades: ["Centro", "Ciudad Vieja", "Pocitos"] },
  { nombre: "Canelones", localidades: ["Las Piedras", "La Paz", "Barros Blancos"] },
  { nombre: "Maldonado", localidades: ["Punta del Este", "San Carlos", "La Barra"] },
  { nombre: "Salto", localidades: ["Salto"] },
];

function getPuestoActual() {
  if (typeof window === "undefined") return null;
  const actual = localStorage.getItem("puestoActual");
  if (actual) {
    try { return JSON.parse(actual); } catch { return null; }
  }
  const p = localStorage.getItem("puesto");
  if (p) { try { return JSON.parse(p); } catch { return null; } }
  return null;
}

export function DireccionEditor({
  value,
  onChange,
  title = "Dirección y Geolocalización",
  defaultOpen = true,
  footer,
}: {
  value: Direccion;
  onChange: (patch: Partial<Direccion>) => void;
  title?: string;
  defaultOpen?: boolean;
  footer?: React.ReactNode;
}) {
  const [localidades, setLocalidades] = useState<string[]>([]);
  const [capasGeoJson, setCapasGeoJson] = useState<any[]>([]);

  useEffect(() => {
    // set localidades when departamento changes
    const depto = departamentos.find((d) => d.nombre === value.departamento);
    setLocalidades(depto ? depto.localidades : []);
  }, [value.departamento]);

  useEffect(() => {
    const puesto = getPuestoActual();
    if (!puesto?.puestoId) return;
    apiGetCapaGoya({ PuestoId: String(puesto.puestoId), TipoCapaId: "" })
      .then((data) => {
        const capasArr = data?.sdtCapasGoya || [];
        const geojsons = capasArr
          .map((capa: any) => {
            try {
              const parsed = typeof capa.CapaGeoJson === "string" ? JSON.parse(capa.CapaGeoJson) : capa.CapaGeoJson;
              if (parsed && parsed.type === "FeatureCollection") return GenexusFeatureCollectionToGeoJson(parsed);
            } catch {}
            return null;
          })
          .filter(Boolean);
        setCapasGeoJson(geojsons);
      })
      .catch(() => setCapasGeoJson([]));
  }, []);

  // zone check whenever coords change
  useEffect(() => {
    if (!value.lat || !value.lng || capasGeoJson.length === 0) return;
    const pt = turfPoint([parseFloat(value.lng), parseFloat(value.lat)]);
    let inZone = false;
    try {
      capasGeoJson.forEach((zona: any) => {
        if (zona?.type === "FeatureCollection") {
          zona.features?.forEach((feature: any) => {
            try { if (booleanPointInPolygon(pt, feature)) inZone = true; } catch {}
          });
        }
      });
    } catch {}
    if (inZone) toast.success("Cliente en zona", { duration: 2500 });
    else toast.error("Cliente fuera de zona", { duration: 2500 });
  }, [value.lat, value.lng, capasGeoJson]);

  const content = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
        <div className="md:col-span-3">
          <Label className="text-xs">Departamento</Label>
          <Select value={value.departamento} onValueChange={(v) => onChange({ departamento: v, localidad: "" })}>
            <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {departamentos.map((d) => (
                <SelectItem key={d.nombre} value={d.nombre}>{d.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">Localidad</Label>
          <Select value={value.localidad} onValueChange={(v) => onChange({ localidad: v })}>
            <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {localidades.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-full">
          <Label className="text-xs">Dirección</Label>
          <Input className="h-8 text-xs" placeholder="Ej: Av. Italia" value={value.calle || ""} onChange={(e) => onChange({ calle: e.target.value })} />
        </div>

        <div>
          <Label className="text-xs">Nº Puerta</Label>
          <Input className="h-8 text-xs" value={value.nroPuerta || ""} onChange={(e) => onChange({ nroPuerta: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Apto</Label>
          <Input className="h-8 text-xs" value={value.local || ""} onChange={(e) => onChange({ local: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Block</Label>
          <Input className="h-8 text-xs" value={value.block || ""} onChange={(e) => onChange({ block: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Nivel</Label>
          <Input className="h-8 text-xs" value={value.nivel || ""} onChange={(e) => onChange({ nivel: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Local</Label>
          <Input className="h-8 text-xs" value={value.local || ""} onChange={(e) => onChange({ local: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Manzana</Label>
          <Input className="h-8 text-xs" value={value.manzana || ""} onChange={(e) => onChange({ manzana: e.target.value })} />
        </div>

        <div className="md:col-span-3">
          <Label className="text-xs">Esquina 1</Label>
          <Input className="h-8 text-xs" value={value.esquina1 || ""} onChange={(e) => onChange({ esquina1: e.target.value })} />
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">Esquina 2</Label>
          <Input className="h-8 text-xs" value={value.esquina2 || ""} onChange={(e) => onChange({ esquina2: e.target.value })} />
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">Latitud</Label>
          <Input className="h-8 text-xs" readOnly value={value.lat || ""} />
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">Longitud</Label>
          <Input className="h-8 text-xs" readOnly value={value.lng || ""} />
        </div>
      </div>

      <div>
        <DynamicMapa
          onChange={(data) => {
            const patch: Partial<Direccion> = {};
            if (data.address) patch.calle = data.address;
            if (data.houseNumber) patch.nroPuerta = data.houseNumber;
            if (data.lat && data.lng) { patch.lat = data.lat; patch.lng = data.lng; }
            onChange(patch);
          }}
          departamento={value.departamento}
          localidad={value.localidad || ""}
          direccion={value.calle || ""}
          nroPuerta={value.nroPuerta || ""}
          esquina1={value.esquina1 || ""}
          esquina2={value.esquina2 || ""}
          zonas={capasGeoJson}
          mapHeightPx={520}
        />
      </div>
    </div>
  );

  return (
    <CollapsibleCard title={title} defaultOpen={defaultOpen}>
      {content}
      {footer && <div className="flex justify-end gap-2 mt-2">{footer}</div>}
    </CollapsibleCard>
  );
}
