"use client";

// "Probar" — ejecuta el endpoint contra el ambiente en el que está parado el
// navegador, pasando por POST /api/docs/try (que corre la llamada del lado del
// servidor, con la sesión del root).
//
// Dos cosas que no son cosméticas:
//
//   · El AMBIENTE sale del host (window.location.host) y se muestra siempre. En
//     producción va en rojo. Es la única señal que separa "probé un GET" de
//     "borré una zona de verdad".
//   · Las ESCRITURAS abren un diálogo que exige escribir el path exacto. No es
//     un "¿estás seguro?" que se clickea sin leer: hay que tipear
//     `/api/zonas/7`. El servidor exige lo mismo y devuelve 428 si no coincide,
//     así que el diálogo no es la única defensa.
import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Play, Plus, Trash2 } from "lucide-react";
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
import { getAuthToken } from "@/lib/authToken";
import { cn } from "@/lib/utils";
import { ambienteDeHost, queryString, rutaConParams, type ValoresPrueba } from "@/lib/docs/ejemplos";
import type { EndpointVista } from "@/lib/docs/vista";
import { BloqueCodigo } from "./bloque-codigo";
import { InsigniaStatus } from "./insignias";

interface RespuestaTry {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duracionMs: number;
  truncado: boolean;
}

interface Props {
  endpoint: EndpointVista;
  origen: string;
  valores: ValoresPrueba;
  onCambio: (valores: ValoresPrueba) => void;
}

/** base64 del pedido: es lo que le permite atravesar el WAF de nginx. */
function aBase64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  bytes.forEach((b) => {
    binario += String.fromCharCode(b);
  });
  return btoa(binario);
}

/** Un JSON se muestra indentado; cualquier otra cosa, tal cual vino. */
function formatearCuerpo(texto: string): string {
  const limpio = (texto ?? "").trim();
  if (!limpio.startsWith("{") && !limpio.startsWith("[")) return texto;
  try {
    return JSON.stringify(JSON.parse(limpio), null, 2);
  } catch {
    return texto;
  }
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

export function Probador({ endpoint, origen, valores, onCambio }: Props) {
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState<RespuestaTry | null>(null);
  const [error, setError] = useState<{ code: string; detalle: string } | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");

  const ambiente = useMemo(
    () => ambienteDeHost(typeof window === "undefined" ? "" : window.location.host),
    [],
  );

  const pathResuelto = rutaConParams(endpoint.ruta, valores.params);
  const faltanParams = /\{[^}]+\}/.test(pathResuelto);
  const urlPrevia = `${origen}${pathResuelto}${queryString(valores.query)}`;

  const headersExtra = Object.entries(valores.headers);

  function actualizar(parcial: Partial<ValoresPrueba>) {
    onCambio({ ...valores, ...parcial });
  }

  async function ejecutar() {
    setEjecutando(true);
    setError(null);
    setResultado(null);
    try {
      const pedido = {
        metodo: endpoint.metodo,
        path: pathResuelto,
        query: valores.query,
        headers: valores.headers,
        body: endpoint.esEscritura && valores.cuerpo.trim() ? valores.cuerpo : undefined,
        confirmacion: endpoint.esEscritura ? pathResuelto : undefined,
      };
      const token = getAuthToken();
      const respuesta = await fetch("/api/docs/try", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ payload: aBase64(JSON.stringify(pedido)) }),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setError({
          code: String(datos?.error ?? `HTTP_${respuesta.status}`),
          detalle: String(datos?.detalle ?? ""),
        });
      } else {
        setResultado(datos as RespuestaTry);
      }
    } catch (err) {
      setError({ code: "SIN_RESPUESTA", detalle: (err as Error)?.message ?? "" });
    } finally {
      setEjecutando(false);
      setDialogoAbierto(false);
      setConfirmacion("");
    }
  }

  function alEjecutar() {
    if (endpoint.esEscritura) {
      setConfirmacion("");
      setDialogoAbierto(true);
      return;
    }
    void ejecutar();
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Play className="size-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Probar este endpoint</h3>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            ambiente.esProd
              ? "bg-destructive/12 text-destructive ring-1 ring-inset ring-destructive/30"
              : "bg-success/15 text-success",
          )}
        >
          {ambiente.esProd ? <AlertTriangle className="size-3" aria-hidden /> : null}
          {ambiente.nombre}
          <span className="font-normal opacity-70">{ambiente.host}</span>
        </span>
      </header>

      <div className="space-y-4 p-4">
        {/* Parámetros de path */}
        {endpoint.parametros.some((p) => p.ubicacion === "path") && (
          <div className="space-y-2">
            <Etiqueta>Parámetros de la ruta</Etiqueta>
            <div className="grid gap-2 sm:grid-cols-2">
              {endpoint.parametros
                .filter((p) => p.ubicacion === "path")
                .map((p) => (
                  <label key={p.nombre} className="space-y-1">
                    <span className="block font-mono text-xs text-foreground">
                      {p.nombre}
                      <span className="ml-1 text-destructive">*</span>
                    </span>
                    <Input
                      value={valores.params[p.nombre] ?? ""}
                      placeholder={p.tipo}
                      onChange={(e) =>
                        actualizar({ params: { ...valores.params, [p.nombre]: e.target.value } })
                      }
                    />
                  </label>
                ))}
            </div>
          </div>
        )}

        {/* Query */}
        {endpoint.parametros.some((p) => p.ubicacion === "query") && (
          <div className="space-y-2">
            <Etiqueta>Query</Etiqueta>
            <div className="grid gap-2 sm:grid-cols-2">
              {endpoint.parametros
                .filter((p) => p.ubicacion === "query")
                .map((p) => (
                  <label key={p.nombre} className="space-y-1">
                    <span className="block font-mono text-xs text-foreground">
                      {p.nombre}
                      {p.requerido ? <span className="ml-1 text-destructive">*</span> : null}
                    </span>
                    {p.opciones.length ? (
                      <select
                        value={valores.query[p.nombre] ?? ""}
                        onChange={(e) =>
                          actualizar({ query: { ...valores.query, [p.nombre]: e.target.value } })
                        }
                        className="h-10 w-full rounded-[var(--radius-md)] border-[1.5px] border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-primary"
                      >
                        <option value="">(sin valor)</option>
                        {p.opciones.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={valores.query[p.nombre] ?? ""}
                        placeholder={p.tipo}
                        onChange={(e) =>
                          actualizar({ query: { ...valores.query, [p.nombre]: e.target.value } })
                        }
                      />
                    )}
                  </label>
                ))}
            </div>
          </div>
        )}

        {/* Headers extra */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Etiqueta>Headers extra</Etiqueta>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => actualizar({ headers: { ...valores.headers, "": "" } })}
            >
              <Plus className="size-3.5" /> Agregar
            </Button>
          </div>
          {headersExtra.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              La sesión (Authorization / cookie) la pone el servidor. Agregá acá una{" "}
              <code className="font-mono">x-api-key</code> si el endpoint la pide.
            </p>
          ) : (
            <div className="space-y-2">
              {headersExtra.map(([clave, valor], indice) => (
                <div key={indice} className="flex gap-2">
                  <Input
                    value={clave}
                    placeholder="nombre"
                    className="font-mono"
                    onChange={(e) => {
                      const nuevo: Record<string, string> = {};
                      headersExtra.forEach(([c, v], i) => {
                        nuevo[i === indice ? e.target.value : c] = v;
                      });
                      actualizar({ headers: nuevo });
                    }}
                  />
                  <Input
                    value={valor}
                    placeholder="valor"
                    className="font-mono"
                    onChange={(e) => {
                      const nuevo = { ...valores.headers };
                      nuevo[clave] = e.target.value;
                      actualizar({ headers: nuevo });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar header ${clave}`}
                    onClick={() => {
                      const nuevo = { ...valores.headers };
                      delete nuevo[clave];
                      actualizar({ headers: nuevo });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cuerpo */}
        {endpoint.esEscritura && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Etiqueta>Cuerpo</Etiqueta>
              {endpoint.cuerpo?.esqueleto ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => actualizar({ cuerpo: endpoint.cuerpo!.esqueleto })}
                >
                  Cargar esqueleto
                </Button>
              ) : null}
            </div>
            <textarea
              value={valores.cuerpo}
              onChange={(e) => actualizar({ cuerpo: e.target.value })}
              rows={7}
              spellCheck={false}
              placeholder={endpoint.cuerpo?.esqueleto ?? "{}"}
              className="w-full rounded-[var(--radius-md)] border-[1.5px] border-input bg-card px-3 py-2 font-mono text-[12.5px] text-foreground shadow-xs outline-none focus-visible:border-primary"
            />
          </div>
        )}

        {/* URL final + ejecutar */}
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] bg-muted/50 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={urlPrevia}>
            {urlPrevia}
          </code>
          <Button
            type="button"
            onClick={alEjecutar}
            disabled={ejecutando || faltanParams}
            variant={endpoint.esEscritura ? "destructive" : "default"}
            size="sm"
          >
            {ejecutando ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {endpoint.esEscritura ? "Ejecutar escritura" : "Ejecutar"}
          </Button>
        </div>
        {faltanParams && (
          <p className="text-xs text-warn">Completá los parámetros de la ruta para poder ejecutar.</p>
        )}

        {/* Resultado */}
        {error && (
          <div className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/8 p-3">
            <p className="text-sm font-semibold text-destructive">{error.code}</p>
            {error.detalle ? <p className="mt-1 text-xs text-foreground/80">{error.detalle}</p> : null}
          </div>
        )}

        {resultado && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <InsigniaStatus status={resultado.status} texto={resultado.statusText} />
              <span className="text-xs text-muted-foreground">{resultado.duracionMs} ms</span>
              {resultado.truncado && (
                <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn">
                  respuesta truncada a 1 MB
                </span>
              )}
            </div>
            <BloqueCodigo
              etiqueta="respuesta"
              codigo={formatearCuerpo(resultado.body) || "(cuerpo vacío)"}
              alturaMaxima="24rem"
            />
            <details className="rounded-[var(--radius-md)] border border-border bg-muted/30 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Headers de la respuesta ({Object.keys(resultado.headers).length})
              </summary>
              <dl className="mt-2 grid gap-1 text-xs">
                {Object.entries(resultado.headers).map(([clave, valor]) => (
                  <div key={clave} className="flex gap-2">
                    <dt className="shrink-0 font-mono text-muted-foreground">{clave}:</dt>
                    <dd className="min-w-0 break-all font-mono text-foreground/90">{valor}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        )}
      </div>

      {/* Confirmación de escritura */}
      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent className="sm:max-w-lg lg:max-w-lg xl:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={ambiente.esProd ? "size-5 text-destructive" : "size-5 text-warn"} />
              Confirmar {endpoint.metodo}
            </DialogTitle>
            <DialogDescription>
              Esto ejecuta una escritura real contra{" "}
              <strong
                className={cn("font-semibold", ambiente.esProd ? "text-destructive" : "text-foreground")}
              >
                {ambiente.nombre}
              </strong>{" "}
              ({ambiente.host}). No hay deshacer.
            </DialogDescription>
          </DialogHeader>

          <div
            className={cn(
              "rounded-[var(--radius-md)] border p-3",
              ambiente.esProd
                ? "border-destructive/40 bg-destructive/8"
                : "border-warn/40 bg-warn/8",
            )}
          >
            <p className="text-xs text-foreground/80">
              Escribí el path exacto para confirmar:
            </p>
            <code className="mt-1 block select-all font-mono text-sm font-semibold text-foreground">
              {pathResuelto}
            </code>
          </div>

          <Input
            autoFocus
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder={pathResuelto}
            className="font-mono"
            aria-label="Path de confirmación"
          />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogoAbierto(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={confirmacion !== pathResuelto || ejecutando}
              onClick={() => void ejecutar()}
            >
              {ejecutando ? <Loader2 className="size-4 animate-spin" /> : null}
              Ejecutar {endpoint.metodo} en {ambiente.nombre}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
