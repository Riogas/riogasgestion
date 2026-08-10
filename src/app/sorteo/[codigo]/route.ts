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

  // `NextResponse.redirect()` exige URL absoluta y la copia tal cual al header
  // `Location`. Detrás del reverse proxy, `request.url` es la interna
  // (`https://localhost:3000/...`), así que el celular que escanea el QR
  // terminaba mandado a un host que para él no existe. Un `Location` relativo
  // lo resuelve el navegador contra la URL que pidió, sin depender de qué
  // `Host` reenvíe el proxy. (El middleware ya emite redirects relativos; los
  // route handlers no.)
  const res = new NextResponse(null, {
    status: 302,
    headers: { Location: "/sorteo" },
  });

  // Código malformado → redirige igual, sin cookie: la página muestra
  // "volvé a escanear" en lugar de un 404. Se borra además la cookie anterior:
  // si no, el QR mal leído mostraría el formulario del código de antes.
  if (CODIGO_REGEX.test(normalizado)) {
    res.cookies.set(COOKIE_CODIGO, normalizado, cookieOpts(MAX_AGE_CODIGO));
  } else {
    res.cookies.delete(COOKIE_CODIGO);
  }

  return res;
}
