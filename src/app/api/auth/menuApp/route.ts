// menuApp → SecuritySuite (secapi), mismo patrón que el login.
// El front postea acá; reenvía a {SECAPI_URL}/api/Menu (GeneXus, fuente principal
// del sidebar) con el token de la cookie + { AplicacionId }.
// Alternativa limpia disponible en secapi: GET /api/db/menu (no usada acá).
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
    const res = await fetch(`${SECAPI_URL}/api/Menu`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ AplicacionId: aplicacionId }),
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
