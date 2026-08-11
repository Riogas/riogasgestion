"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  buscarCandidatas,
  getMapaMatch,
  getMatches,
  revisarMatch,
} from "@/services/callesMatch";
import type {
  CalleSugerida,
  EstadoMatch,
  MapaMatch,
  MatchFila,
} from "@/lib/types/calleMatch";

const MatchMap = dynamic(() => import("./MatchMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  ),
});

const PAGINA = 25;

const COLOR_ESTADO: Record<EstadoMatch, string> = {
  AUTO_CONFIRMADO: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  A_REVISAR: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  RECHAZADO: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  CONFIRMADO_MANUAL: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
};

export default function CallesMatch() {
  const [estado, setEstado] = useState<EstadoMatch | "">("A_REVISAR");
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [filas, setFilas] = useState<MatchFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState<MatchFila | null>(null);
  const [mapa, setMapa] = useState<MapaMatch | null>(null);
  const [accionEnCurso, setAccionEnCurso] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [candidatas, setCandidatas] = useState<CalleSugerida[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await getMatches(estado, PAGINA, pagina * PAGINA);
      setTotal(r.total);
      setFilas(r.filas);
      setSeleccion((prev) => r.filas.find((f) => f.id === prev?.id) ?? r.filas[0] ?? null);
    } finally {
      setCargando(false);
    }
  }, [estado, pagina]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    setMapa(null);
    setCorrigiendo(false);
    setCandidatas([]);
    if (seleccion) {
      void getMapaMatch(seleccion.id).then(setMapa).catch(() => setMapa(null));
    }
  }, [seleccion]);

  // Buscador de candidatas para "corregir", con freno de tipeo.
  useEffect(() => {
    if (!corrigiendo || busqueda.trim().length < 3) {
      setCandidatas([]);
      return;
    }
    const t = setTimeout(() => {
      void buscarCandidatas(busqueda, seleccion?.osm?.departamento)
        .then((r) => setCandidatas(r.filter((c) => c.calleOsmId !== null)))
        .catch(() => setCandidatas([]));
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, corrigiendo, seleccion]);

  const ejecutar = async (
    accion: "aprobar" | "rechazar" | "corregir",
    calleOsmId?: number,
  ) => {
    if (!seleccion) return;
    setAccionEnCurso(true);
    try {
      await revisarMatch(seleccion.id, accion, calleOsmId);
      await cargar();
    } finally {
      setAccionEnCurso(false);
    }
  };

  const paginas = Math.max(1, Math.ceil(total / PAGINA));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(430px,1fr)_minmax(0,1.2fr)]">
      {/* ── Cola de revisión ── */}
      <Card className="flex flex-col overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b p-3">
          <Select
            value={estado || "todos"}
            onValueChange={(v) => {
              setEstado(v === "todos" ? "" : (v as EstadoMatch));
              setPagina(0);
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A_REVISAR">A revisar</SelectItem>
              <SelectItem value="AUTO_CONFIRMADO">Auto-confirmados</SelectItem>
              <SelectItem value="CONFIRMADO_MANUAL">Confirmados a mano</SelectItem>
              <SelectItem value="RECHAZADO">Rechazados</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-sm text-muted-foreground">
            {total} matches · ordenados por clientes
          </span>
        </div>

        <div className="min-h-[420px] flex-1 overflow-y-auto">
          {cargando ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filas.length === 0 ? (
            <EmptyState
              icon={Check}
              title="Nada para revisar"
              description="No hay matches en este estado."
            />
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filas.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => setSeleccion(f)}
                    className={`cursor-pointer border-b transition-colors hover:bg-muted/60 ${
                      seleccion?.id === f.id ? "bg-muted" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {f.nomenclator?.nombre ?? `CALID ${f.nomenclator?.calid}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {f.nomenclator?.ciudad ?? "—"} → {f.osm?.nombre ?? "—"}
                        {f.osm?.localidad ? ` (${f.osm.localidad})` : ""}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Badge variant="outline" className={COLOR_ESTADO[f.estado]}>
                        {f.metodo} {(f.score * 100).toFixed(0)}%
                      </Badge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {f.clientes.toLocaleString("es-UY")} cli
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={pagina === 0}
            onClick={() => setPagina((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            página {pagina + 1} de {paginas}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={pagina + 1 >= paginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* ── Detalle + mapa ── */}
      <div className="flex flex-col gap-4">
        {seleccion ? (
          <>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">
                    {seleccion.nomenclator?.nombre}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      CALID {seleccion.nomenclator?.calid} ·{" "}
                      {seleccion.nomenclator?.ciudad ?? "sin ciudad"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-red-600" />
                    <span className="font-medium">{seleccion.osm?.nombre}</span>
                    <span className="text-muted-foreground">
                      {seleccion.osm?.localidad ?? ""} · {seleccion.osm?.departamento}
                    </span>
                  </div>
                  {seleccion.nomenclator?.exNombre && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Ex-nombre en el nomenclator: {seleccion.nomenclator.exNombre}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className={COLOR_ESTADO[seleccion.estado]}>
                  {seleccion.estado.replaceAll("_", " ")}
                </Badge>
              </div>

              {seleccion.detalle && (
                <div className="mt-3 rounded-md bg-muted/60 p-3 text-sm">
                  <div>{seleccion.detalle.evidencia}</div>
                  {seleccion.detalle.geo && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Geometría: {seleccion.detalle.geo.clientes ?? 0} clientes
                      geolocalizados,{" "}
                      {Math.round((seleccion.detalle.geo.ratio ?? 0) * 100)}% sobre la
                      calle
                      {seleccion.detalle.geo.contradice ? " — CONTRADICE el nombre" : ""}
                    </div>
                  )}
                  {seleccion.detalle.geoSugiere && (
                    <div className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                      La geometría sugiere otra calle: {seleccion.detalle.geoSugiere.nombre}
                    </div>
                  )}
                  {seleccion.detalle.alternativas &&
                    seleccion.detalle.alternativas.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Alternativas:{" "}
                        {seleccion.detalle.alternativas
                          .map((a) => `${a.nombre} (${Math.round(a.score * 100)}%)`)
                          .join(" · ")}
                      </div>
                    )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={accionEnCurso}
                  onClick={() => void ejecutar("aprobar")}
                >
                  <Check className="mr-1 h-4 w-4" /> Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={accionEnCurso}
                  onClick={() => void ejecutar("rechazar")}
                >
                  <X className="mr-1 h-4 w-4" /> Rechazar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={accionEnCurso}
                  onClick={() => setCorrigiendo((v) => !v)}
                >
                  <Pencil className="mr-1 h-4 w-4" /> Corregir…
                </Button>
                {accionEnCurso && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {corrigiendo && (
                <div className="mt-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      className="pl-8"
                      placeholder="Buscar la calle OSM correcta…"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </div>
                  {candidatas.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-md border">
                      {candidatas.map((c) => (
                        <button
                          key={c.calleOsmId}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => void ejecutar("corregir", c.calleOsmId!)}
                        >
                          <span>
                            {c.nombre}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {c.localidad ?? ""} · {c.departamento ?? ""}
                            </span>
                          </span>
                          {c.calid !== null && (
                            <Badge variant="outline">CALID {c.calid}</Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card className="h-[430px] overflow-hidden p-0">
              {mapa ? (
                <MatchMap datos={mapa} />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
            </Card>
            <p className="text-xs text-muted-foreground">
              Rojo: la calle según OSM. Azul: dónde viven los clientes de ese CALID. Si
              la nube azul abraza los puntos rojos, el match es bueno.
            </p>
          </>
        ) : (
          <Card className="flex h-64 items-center justify-center text-muted-foreground">
            Elegí un match de la cola para ver la evidencia.
          </Card>
        )}
      </div>
    </div>
  );
}
