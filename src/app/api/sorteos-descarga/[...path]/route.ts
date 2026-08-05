// Descargas grandes de Sorteos (ZIP de QRs y CSV de participaciones).
//
// No pasan por el catch-all `/api/[...path]`: ese proxy acumula la respuesta
// entera en un Buffer antes de contestar, y un lote de 10.000 QRs son cientos
// de MB por descarga en la RAM del proceso Next. Acá el body del backend se
// pipea tal cual (`NextResponse(resp.body)`), preservando el backpressure que
// implementa el controller Nest.
import { NextRequest, NextResponse } from "next/server";
import { NEST_PREFIX, nestBase } from "@/lib/sorteo/publicApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Armar el ZIP de un lote grande puede llevar varios minutos.
export const maxDuration = 300;

/** Únicas rutas del backend alcanzables por acá: NO es un proxy genérico. */
const RUTAS_PERMITIDAS = [/^\d+\/lotes\/\d+\/zip$/, /^\d+\/participaciones\/export$/];

/** Headers de la respuesta del backend que se reenvían al navegador. */
const HEADERS_A_COPIAR = ["content-type", "content-disposition"];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const ruta = (path ?? []).join("/");

  if (!RUTAS_PERMITIDAS.some((permitida) => permitida.test(ruta))) {
    return NextResponse.json({ error: "Descarga no disponible" }, { status: 404 });
  }

  const autorizacion = request.headers.get("authorization");
  if (!autorizacion) {
    return NextResponse.json({ error: "Falta el token de sesión" }, { status: 401 });
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${nestBase()}${NEST_PREFIX}/sorteos/${ruta}`, {
      method: "GET",
      headers: { authorization: autorizacion },
      cache: "no-store",
    });
  } catch (err) {
    console.error(
      `[sorteos-descarga] backend inaccesible en ${ruta}:`,
      (err as Error)?.message,
    );
    return NextResponse.json(
      { error: "No se pudo conectar con el backend" },
      { status: 502 },
    );
  }

  if (!respuesta.ok || !respuesta.body) {
    console.error(`[sorteos-descarga] backend ${respuesta.status} en ${ruta}`);
    return NextResponse.json(
      { error: "No se pudo generar la descarga" },
      { status: respuesta.ok ? 502 : respuesta.status },
    );
  }

  const headers = new Headers();
  for (const nombre of HEADERS_A_COPIAR) {
    const valor = respuesta.headers.get(nombre);
    if (valor) headers.set(nombre, valor);
  }
  // `content-length` NO se copia: undici puede descomprimir el body y dejar el
  // largo original, que ya no coincide con lo que recibe el navegador.
  headers.set("cache-control", "no-store");

  return new NextResponse(respuesta.body, { status: 200, headers });
}
