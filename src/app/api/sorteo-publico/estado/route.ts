// Estado del código guardado en la cookie `sorteo_codigo`.
// Además siembra las cookies del dispositivo (`sorteo_device`) y del instante
// en que se sirvió el formulario (`sorteo_t0`, usado como honeypot temporal).
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_CODIGO,
  COOKIE_DEVICE,
  COOKIE_T0,
  ESTADO_TIMEOUT_MS,
  EstadoResponse,
  MAX_AGE_DEVICE,
  MAX_AGE_T0,
  apiKey,
  cookieOpts,
  nestUrl,
} from "@/lib/sorteo/publicApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function consultarEstado(
  codigo: string,
  request: NextRequest,
): Promise<EstadoResponse> {
  try {
    const resp = await fetch(
      nestUrl(`/sorteos/publico/estado?codigo=${encodeURIComponent(codigo)}`),
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey(),
          // Si ya viene de un proxy upstream se mantiene la cadena original.
          "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(ESTADO_TIMEOUT_MS),
      },
    );

    if (!resp.ok) {
      console.error(`[sorteo-publico/estado] backend ${resp.status}`);
      return { estado: "error_temporal" };
    }

    return (await resp.json()) as EstadoResponse;
  } catch (err) {
    console.error(
      "[sorteo-publico/estado] backend inaccesible:",
      (err as Error)?.message,
    );
    return { estado: "error_temporal" };
  }
}

export async function GET(request: NextRequest) {
  const codigo = request.cookies.get(COOKIE_CODIGO)?.value;
  const device = request.cookies.get(COOKIE_DEVICE)?.value;

  const body: EstadoResponse = codigo
    ? await consultarEstado(codigo, request)
    : { estado: "sin_cookie" };

  const res = NextResponse.json(body);

  if (!device) {
    res.cookies.set(COOKIE_DEVICE, randomUUID(), cookieOpts(MAX_AGE_DEVICE));
  }
  res.cookies.set(COOKIE_T0, Date.now().toString(), cookieOpts(MAX_AGE_T0));

  return res;
}
