// menuApp → SecuritySuite (secapi), mismo patrón que el login.
// El front postea acá; este handler consulta GET {SECAPI_URL}/api/db/menu?aplicacionId=N
// con el token de la cookie (el menú es por usuario/app). Devuelve { success, menu:[...] }
// con la forma que mapMenuItem ya entiende (key/label/path/icon/type/order/children).
// (El POST /api/Menu de GeneXus devuelve vacío para goya; por eso usamos /api/db/menu.)
import { NextRequest, NextResponse } from "next/server";
import { codigoGuardSecapi } from "@/lib/secapiGuard";

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

  // Sin cookie no hay menú posible: secapi ya no devuelve el árbol completo a
  // los anónimos y no hay de dónde sacarlo (el POST /api/Menu de GeneXus viene
  // vacío para goya). Se corta acá con el mismo motivo que el 401 de secapi
  // para que el front lo trate igual y ofrezca volver a entrar.
  if (!token) {
    return NextResponse.json(
      { error: "SESION_VENCIDA", message: "No hay sesión: volvé a iniciar sesión." },
      { status: 401 },
    );
  }

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
    // El código real del guard viaja en el header `x-auth-guard`; el body sólo
    // trae un mensaje para humanos, igual para todos los 401 y para los dos 503.
    const codigoSecapi = codigoGuardSecapi(res.headers, data);

    // 401 = token rechazado por secapi. Antes esto terminaba en un menú vacío y
    // sin explicación (el front se comía el error): el usuario quedaba con la
    // app abierta, sin barra lateral y sin saber que su sesión murió. Se marca
    // el motivo para que el front lo propague como sesión vencida.
    if (res.status === 401) {
      // USUARIO_NO_ENCONTRADO no es sesión vencida: el usuario no está activo en
      // SecuritySuite y volver a loguearse lo deja entrar igual (el login sólo
      // rechaza el estado 'I'). Si esto saliera como 401, el Sidebar lo mandaría
      // a /login y el usuario giraría para siempre; por eso sale 403, que el
      // front trata como callejón sin salida y no como "volvé a entrar".
      if (codigoSecapi === "USUARIO_NO_ENCONTRADO") {
        return NextResponse.json(
          {
            error: "USUARIO_NO_ACTIVO",
            message:
              "Tu usuario no está activo en SecuritySuite. Volver a iniciar sesión no lo cambia: avisá a Sistemas.",
            detail: codigoSecapi,
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          error: "SESION_VENCIDA",
          message: "La sesión venció. Volvé a iniciar sesión.",
          detail: codigoSecapi, // SIN_TOKEN / TOKEN_INVALIDO / TOKEN_VENCIDO
        },
        { status: 401 },
      );
    }

    // A secapi le falta el secreto de firma: no es la sesión del usuario, es el
    // servidor. Volver a loguearse no lo arregla, así que va con su propio motivo.
    // El otro 503 posible (ERROR_GUARD) es transitorio y NO entra acá: se pasa
    // tal cual más abajo, para no mandar a Sistemas a revisar una variable que
    // está bien.
    if (res.status === 503 && codigoSecapi === "SECRETO_NO_CONFIGURADO") {
      return NextResponse.json(
        {
          error: "SECAPI_NO_CONFIGURADO",
          message:
            "El servicio de seguridad no está configurado. No es tu sesión: avisá a Sistemas.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Error al conectar con SecuritySuite (menu)", detail: (err as Error)?.message },
      { status: 502 },
    );
  }
}
