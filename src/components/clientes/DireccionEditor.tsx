"use client";

import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDepartamentos, getLocalidades } from "@/services/catalogos";
import { calcCalleMatch } from "@/lib/clientes/calle";
import type { DireccionFormValues } from "@/lib/types/cliente";
import { Crosshair, Loader2 } from "lucide-react";

const NONE = "__none__";

export interface DireccionEditorValue extends Partial<DireccionFormValues> {
  // calle del reverse-geocode más reciente (para badge calleMatch)
  _geoCalle?: string | null;
}

interface DireccionEditorProps {
  value: DireccionEditorValue;
  onChange: (patch: Partial<DireccionEditorValue>) => void;
  onGeolocate?: () => void;
  geolocating?: boolean;
  onFocus?: () => void;
}

export function DireccionEditor({
  value,
  onChange,
  onGeolocate,
  geolocating,
  onFocus,
}: DireccionEditorProps) {
  const { data: departamentos = [] } = useQuery({
    queryKey: ["catalogos", "departamentos"],
    queryFn: getDepartamentos,
    staleTime: 5 * 60 * 1000,
  });
  const departamentoId = value.departamentoId ?? null;
  const { data: localidades = [] } = useQuery({
    queryKey: ["catalogos", "localidades", departamentoId],
    queryFn: () => getLocalidades(departamentoId ?? undefined),
    staleTime: 5 * 60 * 1000,
    enabled: departamentoId != null,
  });

  const match = calcCalleMatch(value.calle, value._geoCalle);

  return (
    <div className="space-y-3" onFocusCapture={onFocus}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Calle</Label>
          <Input
            value={value.calle ?? ""}
            onChange={(e) => onChange({ calle: e.target.value })}
            placeholder="Ej: Av. Italia"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">N°</Label>
          <Input
            value={value.nro ?? ""}
            onChange={(e) => onChange({ nro: e.target.value })}
            placeholder="1234"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Esquina 1</Label>
          <Input
            value={value.esquina1 ?? ""}
            onChange={(e) => onChange({ esquina1: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Esquina 2</Label>
          <Input
            value={value.esquina2 ?? ""}
            onChange={(e) => onChange({ esquina2: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Apto</Label>
          <Input
            value={value.apto ?? ""}
            onChange={(e) => onChange({ apto: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Local</Label>
          <Input
            value={value.local ?? ""}
            onChange={(e) => onChange({ local: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Departamento</Label>
          <Select
            value={departamentoId != null ? String(departamentoId) : NONE}
            onValueChange={(v) =>
              onChange({
                departamentoId: v === NONE ? null : Number(v),
                localidadId: null,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Sin departamento —</SelectItem>
              {departamentos.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.nombre ?? `Depto ${d.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Localidad</Label>
          <Select
            value={value.localidadId != null ? String(value.localidadId) : NONE}
            onValueChange={(v) =>
              onChange({ localidadId: v === NONE ? null : Number(v) })
            }
            disabled={departamentoId == null}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Sin localidad —</SelectItem>
              {localidades.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.nombre ?? `Localidad ${l.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onGeolocate}
          disabled={geolocating}
          className="gap-1.5"
        >
          {geolocating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Crosshair className="size-4" />
          )}
          Geolocalizar
        </Button>

        {value.lat != null && value.lng != null && (
          <span className="text-xs text-muted-foreground font-mono">
            {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}
          </span>
        )}

        {match === true && (
          <Badge variant="success" className="text-[11px]">
            ✓ Calle coincide
          </Badge>
        )}
        {match === false && (
          <Badge variant="warn" className="text-[11px]">
            ✗ Calle distinta
          </Badge>
        )}
      </div>
    </div>
  );
}
