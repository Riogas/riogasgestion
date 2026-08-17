// Portal de documentación de APIs — /dashboard/docs.
//
// Server Component a propósito: el gate corre del lado del servidor ANTES de
// renderizar nada. El catálogo dice qué endpoints están sin autenticación, así
// que un gate de UI no alcanza — si el guard no da, acá no se arma ni la vista.
//
// El visor (client) recibe el modelo ya aplanado y no vuelve a pedir el spec:
// una llamada menos y un lugar menos donde el catálogo podría escaparse.
import { headers } from "next/headers";
import { requireRootDesdeCookies } from "@/lib/docs/root-guard";
import { cargarCatalogo } from "@/lib/docs/spec";
import { construirVista } from "@/lib/docs/vista";
import { VisorDocs } from "@/components/docs/visor-docs";

export const dynamic = "force-dynamic";

const MENSAJES: Record<string, string> = {
  NO_TOKEN: "No hay sesión. Entrá de nuevo al panel.",
  TOKEN_INVALIDO: "La firma del token no es válida. Entrá de nuevo al panel.",
  TOKEN_VENCIDO: "La sesión venció. Entrá de nuevo al panel.",
  NO_ROOT:
    "Tu usuario no tiene el permiso docs:view en GOYA. Se otorga con el rol Root de la aplicación.",
  SECRETO_NO_CONFIGURADO:
    "El servidor no tiene JWT_SECRET configurada (o quedó con el valor de ejemplo), así que no puede " +
    "verificar la firma de los tokens. El portal queda cerrado hasta que se configure.",
  SECAPI_URL_NO_CONFIGURADA:
    "El servidor no tiene SECAPI_URL configurada y no hay valor por defecto: no hay contra quién " +
    "verificar el permiso. El portal queda cerrado hasta que se configure.",
  SECAPI_INACCESIBLE:
    "No se pudo verificar el permiso contra SecuritySuite. El portal no se abre sin esa verificación.",
};

function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-border bg-card p-6">
      <h1 className="text-lg font-semibold text-foreground">{titulo}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detalle}</p>
    </div>
  );
}

/**
 * Origen con el que se dibujan los ejemplos en el primer render. El cliente lo
 * confirma con `window.location.origin` al montar; calcularlo acá evita que el
 * curl aparezca sin host durante un frame y que la hidratación no cierre.
 */
async function origenDelRequest(): Promise<string> {
  const hs = await headers();
  const host = (hs.get("x-forwarded-host") ?? hs.get("host") ?? "").split(",")[0].trim();
  if (!host) return "";
  const proto = (hs.get("x-forwarded-proto") ?? "").split(",")[0].trim() || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
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

  let vista;
  try {
    vista = construirVista(cargarCatalogo());
  } catch (err) {
    return <Aviso titulo="Catálogo no disponible" detalle={(err as Error).message} />;
  }

  return (
    <VisorDocs vista={vista} origenInicial={await origenDelRequest()} usuario={guard.usuario} />
  );
}
