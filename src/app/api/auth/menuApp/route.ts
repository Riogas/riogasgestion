// menuApp → SecuritySuite (secapi), mismo patrón que el login.
// El front postea acá; este handler consulta GET {SECAPI_URL}/api/db/menu?aplicacionId=N
// con el token de la cookie (el menú es por usuario/app). Devuelve { success, menu:[...] }
// con la forma que mapMenuItem ya entiende (key/label/path/icon/type/order/children).
// (El POST /api/Menu de GeneXus devuelve vacío para goya; por eso usamos /api/db/menu.)
import { NextRequest, NextResponse } from "next/server";

const SECAPI_URL = (
  process.env.SECAPI_URL || "https://secapi-dev.glp.riogas.com.uy"
).replace(/\/$/, "");

// goya = 3; fallback si la var no quedó en el build
const APP_ID = (() => {
  const n = Number(process.env.NEXT_PUBLIC_APLICACION_ID ?? 3);
  return Number.isFinite(n) && n > 0 ? n : 3;
})();

export async function POST(req: NextRequest) {
  const token = req.cookies.get("token")?.value;

  let body: { AplicacionId?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* body opcional */
  }
  const aplicacionId = Number(body?.AplicacionId) > 0 ? Number(body.AplicacionId) : APP_ID;

  try {
    const res = await fetch(`${SECAPI_URL}/api/db/menu?aplicacionId=${aplicacionId}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(20000),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Error al conectar con SecuritySuite (menu)", detail: (err as Error)?.message },
      { status: 502 },
    );
  }
}
