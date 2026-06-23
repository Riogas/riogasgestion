// Login → SecuritySuite (secapi). Mismo patrón que TrackMovil:
// el front postea acá y este handler reenvía a {SECAPI_URL}/api/db/login con
// { UserName, Password, Sistema }. Devuelve el JSON de secapi { success, token, user, ... }.
// Host por .env (SECAPI_URL): dev → secapi-dev.glp.riogas.com.uy, prod → secapi.riogas.com.uy
import { NextRequest, NextResponse } from "next/server";

const SECAPI_URL = (
  process.env.SECAPI_URL || "https://secapi-dev.glp.riogas.com.uy"
).replace(/\/$/, "");
const SISTEMA = process.env.LOGIN_SISTEMA || "GOYA";

export async function POST(req: NextRequest) {
  let body: { UserName?: string; Password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Body inválido" }, { status: 400 });
  }

  const { UserName, Password } = body;
  if (!UserName || !Password) {
    return NextResponse.json(
      { success: false, message: "Faltan credenciales" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${SECAPI_URL}/api/db/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ UserName, Password, Sistema: SISTEMA }),
      signal: AbortSignal.timeout(20000),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Error al conectar con SecuritySuite", detail: (err as Error)?.message },
      { status: 502 },
    );
  }
}
