// Envío del formulario público. El código y el dispositivo salen de cookies
// httpOnly (nunca del body) y acá se aplican las dos trampas anti-bot antes de
// tocar el backend: honeypot de campo (`hp`) y honeypot temporal (`sorteo_t0`).
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_CODIGO,
  COOKIE_DEVICE,
  COOKIE_T0,
  MAX_AGE_DEVICE,
  MIN_SUBMIT_MS,
  PARTICIPAR_TIMEOUT_MS,
  ParticiparResponse,
  apiKey,
  cookieOpts,
  nestUrl,
} from "@/lib/sorteo/publicApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParticiparBody = {
  nombre?: unknown;
  telefono?: unknown;
  edad?: unknown;
  email?: unknown;
  gpsLat?: unknown;
  gpsLng?: unknown;
  fingerprint?: unknown;
  idioma?: unknown;
  plataforma?: unknown;
  resolucion?: unknown;
  hp?: unknown;
};

function textoOpcional(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : undefined;
}

function numeroOpcional(valor: unknown): number | undefined {
  if (valor === null || valor === undefined || valor === "") return undefined;
  const n = Number(valor);
  return Number.isFinite(n) ? n : undefined;
}

export async function POST(request: NextRequest) {
  const codigo = request.cookies.get(COOKIE_CODIGO)?.value;
  const deviceCookie = request.cookies.get(COOKIE_DEVICE)?.value;
  const t0 = request.cookies.get(COOKIE_T0)?.value;

  // Si el navegador nunca pasó por /estado (o borró la cookie), se genera acá
  // para no perder la participación; se devuelve seteada en la respuesta.
  const deviceId = deviceCookie ?? randomUUID();

  // La cookie `sorteo_codigo` NUNCA se borra: el usuario puede reintentar.
  const responder = (body: ParticiparResponse) => {
    const res = NextResponse.json(body);
    if (!deviceCookie) {
      res.cookies.set(COOKIE_DEVICE, deviceId, cookieOpts(MAX_AGE_DEVICE));
    }
    return res;
  };

  let body: ParticiparBody;
  try {
    body = (await request.json()) as ParticiparBody;
  } catch {
    return responder({ resultado: "invalido" });
  }

  if (!codigo) return responder({ resultado: "invalido" });

  const honeypotLleno = typeof body.hp === "string" && body.hp.length > 0;
  const demasiadoRapido =
    t0 !== undefined && Date.now() - Number(t0) < MIN_SUBMIT_MS;

  // Respuesta indistinguible de una participación real que no ganó: el bot no
  // aprende que fue detectado y el backend ni se entera.
  if (honeypotLleno || demasiadoRapido) {
    return responder({ resultado: "sigue" });
  }

  const payload = {
    codigo,
    deviceId,
    nombre: body.nombre,
    telefono: body.telefono,
    edad: body.edad,
    email: textoOpcional(body.email),
    fingerprint: textoOpcional(body.fingerprint),
    idioma: textoOpcional(body.idioma),
    plataforma: textoOpcional(body.plataforma),
    resolucion: textoOpcional(body.resolucion),
    gpsLat: numeroOpcional(body.gpsLat),
    gpsLng: numeroOpcional(body.gpsLng),
  };

  try {
    const resp = await fetch(nestUrl("/sorteos/publico/participar"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey(),
        "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
        "user-agent": request.headers.get("user-agent") ?? "",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(PARTICIPAR_TIMEOUT_MS),
    });

    if (!resp.ok) {
      console.error(`[sorteo-publico/participar] backend ${resp.status}`);
      return responder({ resultado: "error_temporal" });
    }

    const data = (await resp.json()) as ParticiparResponse;
    if (typeof data?.resultado !== "string") {
      console.error("[sorteo-publico/participar] respuesta sin resultado");
      return responder({ resultado: "error_temporal" });
    }

    return responder(data);
  } catch (err) {
    // Timeout / red caída: el código NO se quema porque la transacción no llegó
    // a commitear; el usuario reintenta.
    console.error(
      "[sorteo-publico/participar] backend inaccesible:",
      (err as Error)?.message,
    );
    return responder({ resultado: "error_temporal" });
  }
}
