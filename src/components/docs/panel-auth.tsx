"use client";

// "Estado de la autenticación": el apartado por el que este portal es solo-root.
//
// No es un resumen simpático del catálogo: es el mapa de qué NO valida cada
// capa, con números y con la lista completa de endpoints. Se muestra entero, no
// escondido detrás de un "ver más", porque el que entra acá ya es root y lo que
// necesita es exactamente esto.
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DESCRIPCION_CATEGORIA,
  ETIQUETA_CATEGORIA,
  esSinValidacion,
  type CategoriaAuth,
  type ResumenAuth,
} from "@/lib/docs/vista";
import { InsigniaAuth, InsigniaMetodo } from "./insignias";
import { TextoRico } from "./texto-rico";

interface Props {
  resumen: ResumenAuth;
  onSeleccionar: (id: string) => void;
}

export function PanelAuth({ resumen, onSeleccionar }: Props) {
  const sinValidar = resumen.sinValidacion.length;
  const porcentaje = resumen.total ? Math.round((sinValidar / resumen.total) * 100) : 0;
  const conteo = (categoria: CategoriaAuth) =>
    resumen.porCategoria.find((c) => c.categoria === categoria)?.cantidad ?? 0;

  const grupos: CategoriaAuth[] = ["ninguna", "publica", "delegada"];

  return (
    <div className="space-y-6">
      {/* Titular con el número */}
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-warn/30 bg-warn/5">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold leading-none tracking-tight text-warn">
              {sinValidar}
            </span>
            <span className="text-sm text-muted-foreground">de {resumen.total}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">
              endpoints no validan nada en esta capa ({porcentaje}%)
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {conteo("ninguna") > 0 ? (
                <>
                  <strong className="text-destructive">{conteo("ninguna")} sin ninguna auth</strong>,{" "}
                </>
              ) : null}
              {conteo("publica")} públicos a propósito (login, health, el formulario del QR) y{" "}
              {conteo("delegada")} que delegan la validación en el destino al que reenvían.
              Los últimos quedan abiertos si el destino tampoco valida.
            </p>
          </div>
        </div>

        {/* Distribución por categoría */}
        <div className="grid grid-cols-2 gap-px border-t border-warn/20 bg-warn/10 sm:grid-cols-3 lg:grid-cols-6">
          {resumen.porCategoria.map((c) => (
            <div key={c.categoria} className="bg-card px-3 py-2.5">
              <p className="text-xl font-semibold leading-tight text-foreground">{c.cantidad}</p>
              <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {ETIQUETA_CATEGORIA[c.categoria]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Listas de los que no validan */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldAlert className="size-4 text-warn" aria-hidden />
          Endpoints sin validación propia
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {grupos.map((categoria) => {
            const lista = resumen.sinValidacion.filter((e) => e.categoriaAuth === categoria);
            if (!lista.length) return null;
            return (
              <div
                key={categoria}
                className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card"
              >
                <div className="border-b border-border px-3 py-2.5">
                  <InsigniaAuth categoria={categoria} />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {DESCRIPCION_CATEGORIA[categoria]}
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {lista.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => onSeleccionar(e.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                      >
                        <InsigniaMetodo metodo={e.metodo} />
                        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                          {e.ruta}
                        </code>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {resumen.sinValidacion.every((e) => !esSinValidacion(e.categoriaAuth)) && (
          <p className="text-sm text-muted-foreground">Todos los endpoints declaran alguna validación.</p>
        )}
      </section>

      {/* Advertencias transversales */}
      {resumen.advertencias.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="size-4 text-destructive" aria-hidden />
            Lo que la lista de arriba no muestra
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Un endpoint puede declarar autenticación y aun así no proteger nada. Esto es lo
            que hay que saber de los que sí validan.
          </p>
          <div className="space-y-3">
            {resumen.advertencias.map((a) => {
              const alta = a.severidad?.toLowerCase() === "alta";
              return (
                <article
                  key={a.titulo}
                  className={cn(
                    "rounded-[var(--radius-lg)] border p-4",
                    alta ? "border-destructive/30 bg-destructive/5" : "border-warn/30 bg-warn/5",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
                        alta ? "bg-destructive/15 text-destructive" : "bg-warn/15 text-warn",
                      )}
                    >
                      severidad {a.severidad}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">{a.titulo}</h3>
                  </div>
                  {a.afecta ? (
                    <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                      Afecta: {a.afecta}
                    </p>
                  ) : null}
                  <TextoRico texto={a.detalle} className="mt-2" />
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
