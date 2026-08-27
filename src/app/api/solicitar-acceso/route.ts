// Route handler: crea una solicitud de acceso en SecuritySuite (secapi).
// El front (pantalla /no-autorizado) postea acá; este handler reenvía a secapi
// con el token de la cookie. El host de secapi sale de SECAPI_URL (.env):
//   dev  → https://secapi-dev.glp.riogas.com.uy
//   prod → https://secapi.riogas.com.uy
import { NextRequest, NextResponse } from "next/server";

const SECAPI_URL = (
  process.env.SECAPI_URL || "https://secapi-dev.glp.riogas.com.uy"
).replace(/\/$/, "");

// goya = 3; fallback por si la var no quedó en el build
const APP_ID = (() => {
  const n = Number(process.env.NEXT_PUBLIC_APLICACION_ID ?? 3);
  return Number.isFinite(n) && n > 0 ? n : 3;
})();

export async function POST(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        motivo: "SESION_VENCIDA",
        error: "Sin sesión (token ausente)",
      },
      { status: 401 },
    );
  }

  let payload: { code?: string; ruta?: string; nombre?: string; motivo?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { code = "", ruta = "", nombre = "", motivo = "" } = payload;
  const segs = String(ruta).split("/").filter(Boolean);
  const objetoKey = segs[segs.length - 1] || "root";
  const objetoPath = "/" + objetoKey;

  const body = {
    AplicacionId: APP_ID,
    ObjetoKey: objetoKey,
    ObjetoTipo: "PAGE",
    AccionKey: "view",
    AccionCodigo: code,
    ObjetoPath: objetoPath,
    Motivo: motivo.trim() || `Necesito acceso a la pantalla de ${nombre || objetoKey}`,
  };

  try {
    const resp = await fetch(`${SECAPI_URL}/api/db/solicitudes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const raw = await resp.text();
    let data: unknown;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    const errorSecapi = (data as { error?: string })?.error;

    // La solicitud viaja con el MISMO token que hizo que el usuario terminara en
    // /no-autorizado. Si ese token es el problema, esto no puede funcionar nunca:
    // hay que decirle que vuelva a entrar, no dejarlo reintentando un formulario
    // condenado. Se marca el motivo para que el botón sepa qué ofrecer.
    if (resp.status === 401) {
      return NextResponse.json(
        { ok: false, motivo: "SESION_VENCIDA", status: resp.status, data },
        { status: 401 },
      );
    }

    if (resp.status === 503 && errorSecapi === "SECRETO_NO_CONFIGURADO") {
      return NextResponse.json(
        { ok: false, motivo: "SECAPI_NO_CONFIGURADO", status: resp.status, data },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { ok: resp.ok, status: resp.status, data },
      { status: resp.ok ? 200 : resp.status },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "No se pudo contactar a secapi", detail: (err as Error)?.message },
      { status: 502 },
    );
  }
}
