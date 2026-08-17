// POST /api/docs/try — ejecuta UNA llamada contra la propia app (solo root).
//
// El gate es el mismo que /api/docs/spec: requireRoot (firma HS256 + exp +
// permiso docs:view contra secapi, fail-closed). Las reglas de qué se puede
// ejecutar viven en src/lib/docs/try-ejecutor.ts, que es donde están los tests.
//
// Este archivo hace sólo lo que necesita el runtime de Next, y EN ESTE ORDEN:
//   1. requireRoot — antes de tocar el cuerpo. Un anónimo no tiene por qué
//      hacernos parsear un JSON arbitrario: eso es memoria gastada pre-auth.
//   2. parsear el cuerpo,
//   3. delegar en manejarTry.
//
// El ORIGEN al que sale la llamada NO se deriva acá y NO sale de ningún header.
// Lo resuelve `resolverOrigenConfiable()` en el ejecutor, desde el entorno del
// proceso (`DOCS_TRY_ORIGEN`, si no el loopback con `PORT`). `Host`,
// `x-forwarded-host`, `Origin` y `Referer` los elige quien manda el request:
// usarlos para elegir el destino convertía esto en un SSRF que además se
// llevaba el JWT del root, porque la llamada sale con su Authorization y su
// Cookie. Del host de entrada acá sólo se usa la comparación anti-CSRF contra
// el `Origin` del navegador, que no elige destino alguno.
import { NextRequest, NextResponse } from "next/server";
import { requireRoot } from "@/lib/docs/root-guard";
import { manejarTry } from "@/lib/docs/try-ejecutor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El endpoint probado puede tardar; el tope real es el timeout de 30 s del ejecutor.
export const maxDuration = 60;

const SIN_CACHE = { "Cache-Control": "no-store" } as const;

/**
 * Host por el que ENTRÓ este request. Se usa únicamente para compararlo con el
 * `Origin` del navegador (anti-CSRF); nunca para armar el destino del fetch.
 */
function hostDeEsteRequest(req: NextRequest): string | null {
  const bruto = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]
    .trim();
  return bruto || null;
}

export async function POST(req: NextRequest) {
  // 1) Gate primero y cortar acá. Nada de trabajo antes de saber quién llama.
  const guard = await requireRoot(req);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.code }, { status: guard.status, headers: SIN_CACHE });
  }

  // 2) Recién con el root verificado se parsea el cuerpo.
  let cuerpo: unknown = null;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json(
      { error: "PAYLOAD_INVALIDO", detalle: "El cuerpo no es JSON." },
      { status: 400, headers: SIN_CACHE },
    );
  }

  // manejarTry vuelve a llamar a requireRoot: es el módulo que es dueño de la
  // regla y no puede depender de que su llamador la haya aplicado. Sale gratis,
  // el resultado de secapi ya quedó cacheado por el paso 1.
  const salida = await manejarTry({
    solicitud: req,
    cuerpo,
    origenDelNavegador: req.headers.get("origin"),
    hostDelRequest: hostDeEsteRequest(req),
  });

  return NextResponse.json(salida.cuerpo, { status: salida.status, headers: SIN_CACHE });
}
