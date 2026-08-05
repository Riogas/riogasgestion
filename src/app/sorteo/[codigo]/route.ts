// Destino del QR: `/sorteo/<CODIGO>` guarda el código en una cookie httpOnly y
// redirige a `/sorteo`, para que el código nunca quede visible en la URL del
// formulario (ni en el historial, ni en un share, ni en el Referer).
import { NextRequest, NextResponse } from "next/server";
import {
  CODIGO_REGEX,
  COOKIE_CODIGO,
  MAX_AGE_CODIGO,
  cookieOpts,
} from "@/lib/sorteo/publicApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await context.params;

  // Los QR se generan en mayúsculas, pero un lector puede normalizar la URL.
  const normalizado = (codigo ?? "").toUpperCase();

  const res = NextResponse.redirect(new URL("/sorteo", request.url), 302);

  // Código malformado → redirige igual, sin cookie: la página muestra
  // "volvé a escanear" en lugar de un 404.
  if (CODIGO_REGEX.test(normalizado)) {
    res.cookies.set(COOKIE_CODIGO, normalizado, cookieOpts(MAX_AGE_CODIGO));
  }

  return res;
}
