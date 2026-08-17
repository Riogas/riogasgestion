"use client";

// Ficha completa de un endpoint: método y path, autenticación, quién lo
// consume, parámetros, cuerpo, respuestas, errores conocidos, ejemplos
// copiables y el probador.
//
// Los ejemplos se generan contra `origen` (el host real del ambiente, que el
// visor toma de window.location.origin) y se recalculan con lo que el root
// carga en el formulario del probador: el curl que se copia es exactamente la
// llamada que se acaba de ejecutar, no una plantilla.
import { useMemo, useState } from "react";
import { FileCode2, Info, ShieldAlert, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ejemplosDe, type ValoresPrueba } from "@/lib/docs/ejemplos";
import { DESCRIPCION_CATEGORIA, type EndpointVista } from "@/lib/docs/vista";
import { BloqueCodigo } from "./bloque-codigo";
import { InsigniaAuth, InsigniaMetodo } from "./insignias";
import { Probador } from "./probador";
import { TextoRico } from "./texto-rico";

interface Props {
  endpoint: EndpointVista;
  origen: string;
}

function Seccion({
  titulo,
  children,
  contador,
}: {
  titulo: string;
  contador?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
        {typeof contador === "number" ? (
          <span className="font-normal normal-case tracking-normal">({contador})</span>
        ) : null}
      </h3>
      {children}
    </section>
  );
}

function Tabla({ cabeceras, children }: { cabeceras: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/60 text-left">
            {cabeceras.map((c) => (
              <th
                key={c}
                className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function DetalleEndpoint({ endpoint, origen }: Props) {
  const [valores, setValores] = useState<ValoresPrueba>({
    params: {},
    query: {},
    headers: {},
    cuerpo: "",
  });
  const [ejemploActivo, setEjemploActivo] = useState(0);

  const ejemplos = useMemo(
    () => ejemplosDe(endpoint, origen, valores),
    [endpoint, origen, valores],
  );
  const indiceEjemplo = Math.min(ejemploActivo, ejemplos.length - 1);

  const parametrosPath = endpoint.parametros.filter((p) => p.ubicacion === "path");
  const parametrosQuery = endpoint.parametros.filter((p) => p.ubicacion !== "path");

  return (
    <article className="space-y-6">
      {/* Cabecera */}
      <header className="space-y-3 border-b border-border pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <InsigniaMetodo metodo={endpoint.metodo} className="px-2 py-1 text-xs" />
          <code className="min-w-0 break-all font-mono text-base font-semibold text-foreground sm:text-lg">
            {endpoint.ruta}
          </code>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InsigniaAuth categoria={endpoint.categoriaAuth} />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {endpoint.modulo}
          </span>
          {!endpoint.anotado && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              sin anotar a mano
            </span>
          )}
        </div>
        {endpoint.resumen && (
          <p className="text-[15px] leading-relaxed text-foreground">{endpoint.resumen}</p>
        )}
        {endpoint.archivo && (
          <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <FileCode2 className="size-3.5 shrink-0" aria-hidden />
            {endpoint.archivo}
            {endpoint.origen ? <span className="opacity-70">· {endpoint.origen}</span> : null}
          </p>
        )}
      </header>

      {endpoint.descripcion && endpoint.descripcion !== endpoint.resumen && (
        <TextoRico texto={endpoint.descripcion} />
      )}

      {/* Autenticación + consumidores */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-border bg-card p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldAlert className="size-3.5" aria-hidden /> Autenticación
          </h3>
          <p className="mt-2 text-sm text-foreground">{endpoint.auth}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {DESCRIPCION_CATEGORIA[endpoint.categoriaAuth]}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-card p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="size-3.5" aria-hidden /> Quién lo consume
          </h3>
          {endpoint.consumidores.length ? (
            <ul className="mt-2 space-y-1">
              {endpoint.consumidores.map((c) => (
                <li key={c} className="flex gap-2 text-sm text-foreground">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Sin anotar. Si sabés quién llama a este endpoint, agregalo en{" "}
              <code className="font-mono text-xs">docs/api/anotaciones.yaml</code>.
            </p>
          )}
        </div>
      </div>

      {endpoint.notas && (
        <div className="flex gap-2.5 rounded-[var(--radius-md)] border border-primary/25 bg-primary/5 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <TextoRico texto={endpoint.notas} className="text-foreground/90" />
        </div>
      )}

      {/* Parámetros */}
      {(parametrosPath.length > 0 || parametrosQuery.length > 0) && (
        <Seccion titulo="Parámetros" contador={endpoint.parametros.length}>
          <Tabla cabeceras={["Nombre", "En", "Tipo", "Req.", "Descripción"]}>
            {[...parametrosPath, ...parametrosQuery].map((p) => (
              <tr key={`${p.ubicacion}-${p.nombre}`} className="align-top">
                <td className="px-3 py-2 font-mono text-[13px] text-foreground">{p.nombre}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{p.ubicacion}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {p.tipo}
                  {p.opciones.length ? (
                    <span className="block text-[11px] text-foreground/70">
                      {p.opciones.join(" | ")}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.requerido ? (
                    <span className="font-semibold text-destructive">sí</span>
                  ) : (
                    <span className="text-muted-foreground">no</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[13px] text-foreground/85">
                  {p.descripcion || <span className="text-muted-foreground">—</span>}
                  {p.restricciones ? (
                    <span className="block text-[11px] text-muted-foreground">{p.restricciones}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </Tabla>
        </Seccion>
      )}

      {/* Cuerpo */}
      {endpoint.cuerpo && (
        <Seccion titulo={`Cuerpo del request · ${endpoint.cuerpo.contentType}`}>
          {endpoint.cuerpo.descripcion && <TextoRico texto={endpoint.cuerpo.descripcion} />}
          {endpoint.cuerpo.campos.length > 0 && (
            <Tabla cabeceras={["Campo", "Tipo", "Req.", "Restricciones"]}>
              {endpoint.cuerpo.campos.map((c) => (
                <tr key={c.nombre} className="align-top">
                  <td className="px-3 py-2 font-mono text-[13px] text-foreground">{c.nombre}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {c.tipo}
                    {c.opciones.length ? (
                      <span className="block text-[11px] text-foreground/70">
                        {c.opciones.join(" | ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c.requerido ? (
                      <span className="font-semibold text-destructive">sí</span>
                    ) : (
                      <span className="text-muted-foreground">no</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[13px] text-foreground/85">
                    {c.descripcion}
                    {c.restricciones ? (
                      <span className="block text-[11px] text-muted-foreground">{c.restricciones}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </Tabla>
          )}
          {endpoint.cuerpo.esqueleto && endpoint.cuerpo.esqueleto !== "{}" && (
            <BloqueCodigo
              etiqueta={endpoint.cuerpo.schemaNombre || "cuerpo de ejemplo"}
              codigo={endpoint.cuerpo.esqueleto}
              alturaMaxima="18rem"
            />
          )}
        </Seccion>
      )}

      {/* Respuestas */}
      {endpoint.respuestas.length > 0 && (
        <Seccion titulo="Respuestas" contador={endpoint.respuestas.length}>
          <div className="space-y-2">
            {endpoint.respuestas.map((r) => (
              <div key={r.codigo} className="rounded-[var(--radius-md)] border border-border bg-card">
                <div className="flex flex-wrap items-baseline gap-2 px-3 py-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-xs font-bold",
                      r.codigo.startsWith("2")
                        ? "bg-success/15 text-success"
                        : r.codigo.startsWith("4")
                          ? "bg-warn/15 text-warn"
                          : r.codigo.startsWith("5")
                            ? "bg-destructive/12 text-destructive"
                            : "bg-muted text-muted-foreground",
                    )}
                  >
                    {r.codigo}
                  </span>
                  <span className="text-[13px] text-foreground/85">
                    {r.descripcion || (
                      <span className="text-muted-foreground">
                        sin descripción — el generador pone el código por defecto de Nest
                      </span>
                    )}
                  </span>
                </div>
                {r.ejemplo ? (
                  <div className="px-3 pb-3">
                    <BloqueCodigo etiqueta="ejemplo" codigo={r.ejemplo.trimEnd()} alturaMaxima="18rem" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* Errores */}
      {endpoint.errores.length > 0 && (
        <Seccion titulo="Errores conocidos" contador={endpoint.errores.length}>
          <Tabla cabeceras={["Código", "Cuándo", "Cuerpo"]}>
            {endpoint.errores.map((e, i) => (
              <tr key={`${e.codigo}-${i}`} className="align-top">
                <td className="px-3 py-2 font-mono text-[13px] font-semibold text-warn">{e.codigo}</td>
                <td className="px-3 py-2 text-[13px] text-foreground/85">{e.cuando}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{e.cuerpo}</td>
              </tr>
            ))}
          </Tabla>
        </Seccion>
      )}

      {/* Ejemplos */}
      <Seccion titulo="Ejemplos">
        <div className="flex flex-wrap gap-1.5">
          {ejemplos.map((e, i) => (
            <button
              key={e.clave}
              type="button"
              onClick={() => setEjemploActivo(i)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === indiceEjemplo
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {e.titulo}
            </button>
          ))}
        </div>
        <BloqueCodigo
          etiqueta={ejemplos[indiceEjemplo]?.lenguaje ?? "bash"}
          codigo={ejemplos[indiceEjemplo]?.codigo ?? ""}
          alturaMaxima="22rem"
        />
      </Seccion>

      <Probador endpoint={endpoint} origen={origen} valores={valores} onCambio={setValores} />
    </article>
  );
}
