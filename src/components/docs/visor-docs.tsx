"use client";

// Visor del catálogo de APIs. Recibe la vista ya armada del servidor (la página
// es un Server Component detrás del gate root) y no vuelve a pedir nada: todo
// el filtrado es local sobre 108 endpoints, que es instantáneo y no le pega a
// la red en cada tecla.
//
// Dos columnas en pantalla grande: navegación por módulo a la izquierda, ficha
// del endpoint a la derecha. En una notebook entra sin scroll horizontal; abajo
// de `lg` se apila y la lista pasa a ser un panel scrolleable.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronRight, Search, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizar, type EndpointVista, type VistaDocs } from "@/lib/docs/vista";
import { DetalleEndpoint } from "./detalle-endpoint";
import { InsigniaAuth, InsigniaMetodo } from "./insignias";
import { PanelAuth } from "./panel-auth";

interface Props {
  vista: VistaDocs;
  /** Origen del ambiente calculado en el servidor; el cliente lo confirma al montar. */
  origenInicial: string;
  usuario: { username: string; razon: string };
}

type Pestania = "catalogo" | "auth";

function Estadistica({
  valor,
  etiqueta,
  tono = "neutro",
  onClick,
}: {
  valor: number | string;
  etiqueta: string;
  tono?: "neutro" | "alerta";
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors duration-150",
        tono === "alerta"
          ? "border-warn/30 bg-warn/5"
          : "border-border bg-card",
        onClick ? "hover:border-primary/40 hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-ring" : "",
      )}
    >
      <p
        className={cn(
          "text-xl font-semibold leading-tight",
          tono === "alerta" ? "text-warn" : "text-foreground",
        )}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
    </Comp>
  );
}

export function VisorDocs({ vista, origenInicial, usuario }: Props) {
  const [pestania, setPestania] = useState<Pestania>("catalogo");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionadoId, setSeleccionadoId] = useState<string>(vista.endpoints[0]?.id ?? "");
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [origen, setOrigen] = useState(origenInicial);
  const buscadorRef = useRef<HTMLInputElement>(null);

  // El host real manda sobre lo que dedujo el servidor: los ejemplos que se
  // copian tienen que apuntar al ambiente por el que se entró.
  useEffect(() => {
    if (typeof window !== "undefined") setOrigen(window.location.origin);
  }, []);

  // Deep link: /dashboard/docs#get-api-calles-buscar
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ancla = window.location.hash.replace(/^#/, "");
    if (ancla && vista.endpoints.some((e) => e.id === ancla)) setSeleccionadoId(ancla);
  }, [vista.endpoints]);

  // "/" enfoca el buscador, como en cualquier documentación decente.
  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      const activo = document.activeElement?.tagName;
      if (evento.key === "/" && activo !== "INPUT" && activo !== "TEXTAREA") {
        evento.preventDefault();
        buscadorRef.current?.focus();
      }
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  const seleccionar = useCallback((id: string) => {
    setSeleccionadoId(id);
    setPestania("catalogo");
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  }, []);

  const termino = normalizar(busqueda.trim());
  const filtrados = useMemo(() => {
    if (!termino) return vista.endpoints;
    const partes = termino.split(/\s+/).filter(Boolean);
    return vista.endpoints.filter((e) => partes.every((p) => e.busqueda.includes(p)));
  }, [termino, vista.endpoints]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, EndpointVista[]>();
    for (const e of filtrados) {
      const lista = mapa.get(e.modulo) ?? [];
      lista.push(e);
      mapa.set(e.modulo, lista);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  const seleccionado =
    vista.endpoints.find((e) => e.id === seleccionadoId) ?? filtrados[0] ?? vista.endpoints[0];

  const moduloSeleccionado = seleccionado?.modulo ?? "";

  function estaAbierto(modulo: string): boolean {
    if (termino) return true;
    return abiertos.has(modulo) || modulo === moduloSeleccionado;
  }

  function alternar(modulo: string) {
    setAbiertos((previos) => {
      const nuevo = new Set(previos);
      if (nuevo.has(modulo)) nuevo.delete(modulo);
      else nuevo.add(modulo);
      // Un módulo abierto por ser el del seleccionado se cierra igual: se saca
      // la selección del cálculo agregándolo/quitándolo explícitamente.
      if (modulo === moduloSeleccionado && !nuevo.has(modulo)) nuevo.delete(modulo);
      return nuevo;
    });
  }

  const sinValidar = vista.resumen.sinValidacion.length;

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              <BookOpen className="size-6 text-primary" aria-hidden />
              Documentación de APIs
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {vista.titulo} · {vista.endpoints.length} endpoints en {vista.modulos.length} módulos ·
              generado con <code className="font-mono text-xs">pnpm docs:api</code>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {usuario.username || "(sin username en el token)"} · acceso por{" "}
            <span className="font-mono">{usuario.razon}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Estadistica valor={vista.endpoints.length} etiqueta="endpoints" />
          <Estadistica valor={vista.modulos.length} etiqueta="módulos" />
          <Estadistica valor={vista.anotados} etiqueta="con notas a mano" />
          <Estadistica
            valor={sinValidar}
            etiqueta="sin validar acá"
            tono="alerta"
            onClick={() => setPestania("auth")}
          />
        </div>

        {vista.huerfanas.length > 0 && (
          <div className="rounded-[var(--radius-md)] border border-warn/40 bg-warn/5 px-3 py-2 text-sm text-foreground">
            <strong className="font-medium">Anotaciones sin endpoint:</strong>{" "}
            {vista.huerfanas.join(", ")} — el yaml quedó desactualizado respecto del generado.
          </div>
        )}

        {/* Pestañas */}
        <div className="flex gap-1 border-b border-border">
          {(
            [
              ["catalogo", "Catálogo", null],
              ["auth", "Estado de la autenticación", sinValidar],
            ] as Array<[Pestania, string, number | null]>
          ).map(([clave, etiqueta, contador]) => (
            <button
              key={clave}
              type="button"
              onClick={() => setPestania(clave)}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                pestania === clave
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {clave === "auth" ? <ShieldAlert className="size-4" aria-hidden /> : null}
              {etiqueta}
              {contador !== null ? (
                <span className="rounded-full bg-warn/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-warn">
                  {contador}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </header>

      {pestania === "auth" ? (
        <PanelAuth resumen={vista.resumen} onSeleccionar={seleccionar} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* Navegación */}
          {/* top-[4.5rem]: el navbar del dashboard es `sticky top-0 h-16` (64px);
              con menos que eso la búsqueda queda tapada al scrollear. */}
          <aside className="lg:sticky lg:top-[4.5rem] lg:self-start">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                ref={buscadorRef}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar path, método, módulo o texto…"
                aria-label="Buscar endpoints"
                className={cn(
                  "h-10 w-full rounded-[var(--radius-md)] border-[1.5px] border-input bg-card pl-9 pr-8",
                  "text-sm text-foreground shadow-xs placeholder:text-muted-foreground",
                  "outline-none transition-[border-color,box-shadow] duration-150",
                  "focus-visible:border-primary focus-visible:shadow-[var(--shadow-glow-primary)]",
                )}
              />
              {busqueda ? (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <p className="mt-2 px-1 text-[11px] text-muted-foreground">
              {filtrados.length === vista.endpoints.length
                ? "Tecleá / para buscar"
                : `${filtrados.length} de ${vista.endpoints.length} endpoints`}
            </p>

            <nav
              aria-label="Endpoints por módulo"
              className="mt-2 max-h-[60vh] overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-card lg:max-h-[calc(100vh-12rem)]"
            >
              {grupos.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Ningún endpoint coincide con la búsqueda.
                </p>
              ) : (
                grupos.map(([modulo, lista]) => {
                  const abierto = estaAbierto(modulo);
                  const sinAuth = lista.filter((e) => e.categoriaAuth === "ninguna").length;
                  return (
                    <div key={modulo} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        onClick={() => alternar(modulo)}
                        aria-expanded={abierto}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      >
                        <ChevronRight
                          className={cn(
                            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                            abierto && "rotate-90",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                          {modulo}
                        </span>
                        {sinAuth > 0 ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-destructive"
                            title={`${sinAuth} sin autenticación`}
                          />
                        ) : null}
                        <span className="shrink-0 text-[11px] text-muted-foreground">{lista.length}</span>
                      </button>
                      {abierto ? (
                        <ul className="pb-1">
                          {lista.map((e) => (
                            <li key={e.id}>
                              <button
                                type="button"
                                onClick={() => seleccionar(e.id)}
                                aria-current={e.id === seleccionado?.id}
                                className={cn(
                                  "flex w-full items-center gap-2 py-1.5 pl-3 pr-2 text-left transition-colors duration-150",
                                  "border-l-2 focus-visible:outline-none",
                                  e.id === seleccionado?.id
                                    ? "border-primary bg-primary/8"
                                    : "border-transparent hover:bg-muted/50 focus-visible:bg-muted/50",
                                )}
                              >
                                <InsigniaMetodo metodo={e.metodo} />
                                <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground/90">
                                  {e.ruta}
                                </code>
                                {e.categoriaAuth === "ninguna" || e.categoriaAuth === "publica" ? (
                                  <InsigniaAuth categoria={e.categoriaAuth} compacta />
                                ) : null}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })
              )}
            </nav>
          </aside>

          {/* Ficha */}
          <main className="min-w-0">
            {seleccionado ? (
              <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4 sm:p-6">
                <DetalleEndpoint key={seleccionado.id} endpoint={seleccionado} origen={origen} />
              </div>
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center">
                <p className="text-sm text-muted-foreground">Elegí un endpoint de la izquierda.</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
