// Portal de documentación de APIs — versión mínima (fase 1 del diseño
// docs/superpowers/specs/2026-08-17-portal-docs-apis-design.md).
//
// Server Component a propósito: el gate corre del lado del servidor ANTES de
// renderizar nada. El catálogo dice qué endpoints están sin autenticación, así
// que un gate de UI no alcanza. El visor lindo (búsqueda, parámetros, ejemplos,
// "try it") es la fase 4/5; acá va la lista cruda agrupada por módulo.
import { agruparPorModulo, cargarCatalogo } from "@/lib/docs/spec";
import { requireRootDesdeCookies } from "@/lib/docs/root-guard";

export const dynamic = "force-dynamic";

const MENSAJES: Record<string, string> = {
  NO_TOKEN: "No hay sesión. Entrá de nuevo al panel.",
  NO_ROOT: "Tu usuario no tiene el permiso docs:view en GOYA. Se otorga con el rol Root de la aplicación.",
  SECAPI_INACCESIBLE:
    "No se pudo verificar el permiso contra SecuritySuite. El portal no se abre sin esa verificación.",
};

function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6">
      <h1 className="text-lg font-semibold text-foreground">{titulo}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{detalle}</p>
    </div>
  );
}

/** Color por método, siguiendo los tokens del tema (sin emojis, sin librerías). */
function colorMetodo(metodo: string): string {
  switch (metodo) {
    case "GET":
      return "bg-primary/10 text-primary";
    case "POST":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "PATCH":
    case "PUT":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "DELETE":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default async function DocsPage() {
  const guard = await requireRootDesdeCookies();
  if (!guard.ok) {
    return (
      <Aviso
        titulo="Documentación de APIs — sin acceso"
        detalle={MENSAJES[guard.code] ?? `Acceso denegado (${guard.code}).`}
      />
    );
  }

  let catalogo;
  try {
    catalogo = cargarCatalogo();
  } catch (err) {
    return <Aviso titulo="Catálogo no disponible" detalle={(err as Error).message} />;
  }

  const { endpoints, huerfanas } = catalogo;
  const grupos = agruparPorModulo(endpoints);
  const anotados = endpoints.filter((e) => e.anotado).length;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Documentación de APIs</h1>
        <p className="text-sm text-muted-foreground">
          {endpoints.length} endpoints en {grupos.length} módulos · {anotados} con notas a mano ·
          generado con <code className="font-mono">pnpm docs:api</code>
        </p>
        <p className="text-xs text-muted-foreground">
          Sesión: {guard.usuario.username || "(sin username en el token)"} · acceso por{" "}
          {guard.usuario.razon}
        </p>
      </header>

      {huerfanas.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-foreground">
          <strong className="font-medium">Anotaciones sin endpoint:</strong>{" "}
          {huerfanas.join(", ")} — el yaml quedó desactualizado respecto del generado.
        </div>
      )}

      {grupos.map(([modulo, lista]) => (
        <section key={modulo} className="rounded-xl border border-border bg-card">
          <h2 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">
            {modulo}
            <span className="ml-2 font-normal text-muted-foreground">({lista.length})</span>
          </h2>
          <ul className="divide-y divide-border">
            {lista.map((e) => (
              <li
                key={`${e.metodo} ${e.ruta}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${colorMetodo(e.metodo)}`}
                >
                  {e.metodo}
                </span>
                <code className="font-mono text-sm text-foreground">{e.ruta}</code>
                <span className="text-xs text-muted-foreground">auth: {e.auth}</span>
                {e.resumen && (
                  <span className="w-full text-xs text-muted-foreground">{e.resumen}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
