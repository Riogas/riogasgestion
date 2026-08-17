// POST /api/docs/try — ejecuta UNA llamada contra la propia app (solo root).
//
// El gate es el mismo que /api/docs/spec: requireRoot (firma HS256 + exp +
// permiso docs:view contra secapi, fail-closed). Las reglas de qué se puede
// ejecutar viven en src/lib/docs/try-ejecutor.ts, que es donde están los tests.
//
// Este archivo hace sólo lo que necesita el runtime de Next:
//   1. parsear el cuerpo,
//   2. derivar el ORIGEN de esta app desde los headers del request,
//   3. delegar en manejarTry.
//
// El origen sale del request y no de una variable de entorno a propósito: la
// llamada tiene que salir contra el MISMO host por el que entró el root (dev
// contra dev, prod contra prod), sin que una var mal seteada mande un POST al
// ambiente equivocado.
import { NextRequest, NextResponse } from "next/server";
import { manejarTry } from "@/lib/docs/try-ejecutor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El endpoint probado puede tardar; el tope real es el timeout de 30 s del ejecutor.
export const maxDuration = 60;

/** Sólo lo que puede aparecer en un Host válido: nada de espacios ni de barras. */
const HOST_VALIDO = /^[a-z0-9.-]+(:\d{1,5})?$/i;

/**
 * Origen de esta app. Detrás de nginx el request llega con `x-forwarded-host` y
 * `x-forwarded-proto`; en local, con `host` y el protocolo de la URL.
 */
function origenDeLaApp(req: NextRequest): string | null {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim();
  if (!host || !HOST_VALIDO.test(host)) return null;

  const protoBruto = (req.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim().toLowerCase();
  let proto = protoBruto === "https" || protoBruto === "http" ? protoBruto : "";
  if (!proto) {
    try {
      proto = new URL(req.url).protocol.replace(":", "") || "http";
    } catch {
      proto = "http";
    }
  }
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const origen = origenDeLaApp(req);
  if (!origen) {
    return NextResponse.json(
      { error: "ORIGEN_NO_DERIVABLE", detalle: "El request no trae un Host válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let cuerpo: unknown = null;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json(
      { error: "PAYLOAD_INVALIDO", detalle: "El cuerpo no es JSON." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const salida = await manejarTry({
    solicitud: req,
    cuerpo,
    origen,
    origenDelNavegador: req.headers.get("origin"),
  });

  return NextResponse.json(salida.cuerpo, {
    status: salida.status,
    headers: { "Cache-Control": "no-store" },
  });
}
