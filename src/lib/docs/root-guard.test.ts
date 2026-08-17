// Test del gate root del portal de documentación.
//   pnpm test:docs
//
// Corre con el runner de Node (node:test) + tsx. No usa Playwright a propósito:
// esto es una unidad pura, no necesita navegador ni servidor. `fetch` global se
// reemplaza por un doble que simula a secapi.
//
// Dos bloques: la verificación LOCAL del JWT (firma, vencimiento, configuración)
// y la verificación REMOTA del permiso contra secapi.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { limpiarCacheDocs, requireRoot } from "./root-guard";

const fetchReal = globalThis.fetch;
const SECRETO = "secreto-de-test-no-el-de-produccion";
/** El default público que trae el código de secapi: vale lo mismo que no tener secreto. */
const SECRETO_DEFAULT = "security-suite-secret-key";
const SECAPI = "https://secapi.test";

const envOriginal = {
  JWT_SECRET: process.env.JWT_SECRET,
  SECAPI_URL: process.env.SECAPI_URL,
};

/** JWT de verdad, firmado HS256 con el secreto de test. */
function token(username: string, opciones: jwt.SignOptions = {}, secreto = SECRETO): string {
  return jwt.sign({ username, sistema: "GOYA" }, secreto, { expiresIn: "1h", ...opciones });
}

/**
 * El token que hoy abre CUALQUIER app del ecosistema: tres partes, payload en
 * base64 y una firma inventada. Ninguna app verifica la firma; este guard sí.
 */
function tokenFabricado(username: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ username, sistema: "GOYA" })).toString("base64url");
  return `${header}.${payload}.firma-inventada`;
}

function solicitud(tk?: string) {
  return {
    headers: { get: (n: string) => (n.toLowerCase() === "authorization" && tk ? `Bearer ${tk}` : null) },
    cookies: { get: () => undefined },
  };
}

/** Reemplaza fetch y cuenta las llamadas. */
function stubSecapi(responder: () => Promise<Response> | Response) {
  const estado = { llamadas: 0 };
  globalThis.fetch = (async () => {
    estado.llamadas += 1;
    return responder();
  }) as typeof fetch;
  return estado;
}

function respuestaSecapi(permitido: "GRANTED" | "DENIED", razon: string) {
  return new Response(JSON.stringify({ resultados: [{ accionKey: "view", permitido, razon }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("requireRoot", () => {
  beforeEach(() => {
    limpiarCacheDocs();
    process.env.JWT_SECRET = SECRETO;
    process.env.SECAPI_URL = SECAPI;
  });
  afterEach(() => {
    globalThis.fetch = fetchReal;
    if (envOriginal.JWT_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = envOriginal.JWT_SECRET;
    if (envOriginal.SECAPI_URL === undefined) delete process.env.SECAPI_URL;
    else process.env.SECAPI_URL = envOriginal.SECAPI_URL;
  });

  // ── Verificación local del JWT ───────────────────────────────────────────

  it("un token fabricado a mano (firma inventada) es 401 y NO llega a secapi", async () => {
    const estado = stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    const r = await requireRoot(solicitud(tokenFabricado("dmedaglia")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 401);
    assert.equal(r.code, "TOKEN_INVALIDO");
    assert.equal(estado.llamadas, 0);
  });

  it("un token firmado con otro secreto es 401 TOKEN_INVALIDO", async () => {
    stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    const r = await requireRoot(solicitud(token("dmedaglia", {}, "otro-secreto")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 401);
    assert.equal(r.code, "TOKEN_INVALIDO");
  });

  it("un token vencido es 401 TOKEN_VENCIDO y NO llega a secapi", async () => {
    const estado = stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    const r = await requireRoot(solicitud(token("dmedaglia", { expiresIn: -60 })));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 401);
    assert.equal(r.code, "TOKEN_VENCIDO");
    assert.equal(estado.llamadas, 0);
  });

  it("un token con alg 'none' es 401 TOKEN_INVALIDO", async () => {
    stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));
    const sinFirma = jwt.sign({ username: "dmedaglia" }, "", { algorithm: "none" });

    const r = await requireRoot(solicitud(sinFirma));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 401);
    assert.equal(r.code, "TOKEN_INVALIDO");
  });

  it("un token firmado y vigente pasa", async () => {
    stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    const r = await requireRoot(solicitud(token("dmedaglia")));

    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.usuario.username, "dmedaglia");
    assert.equal(r.usuario.razon, "ROOT");
  });

  // ── Configuración: fail-closed ───────────────────────────────────────────

  it("sin JWT_SECRET devuelve 503 SECRETO_NO_CONFIGURADO y NO abre", async () => {
    delete process.env.JWT_SECRET;
    const estado = stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    const r = await requireRoot(solicitud(tokenFabricado("dmedaglia")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 503);
    assert.equal(r.code, "SECRETO_NO_CONFIGURADO");
    assert.equal(estado.llamadas, 0);
  });

  it("con JWT_SECRET igual al default del código también devuelve 503", async () => {
    process.env.JWT_SECRET = SECRETO_DEFAULT;
    stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    // Aunque el token esté correctamente firmado CON ese default: el secreto es
    // público, firmar con él no prueba nada.
    const r = await requireRoot(solicitud(token("dmedaglia", {}, SECRETO_DEFAULT)));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 503);
    assert.equal(r.code, "SECRETO_NO_CONFIGURADO");
  });

  it("sin SECAPI_URL devuelve 503 SECAPI_URL_NO_CONFIGURADA (no hay fallback a dev)", async () => {
    delete process.env.SECAPI_URL;
    const estado = stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    const r = await requireRoot(solicitud(token("dmedaglia")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 503);
    assert.equal(r.code, "SECAPI_URL_NO_CONFIGURADA");
    assert.equal(estado.llamadas, 0);
  });

  // ── Verificación remota del permiso ──────────────────────────────────────

  it("acepta también el otorgamiento por rol Root (razón ROL_FUNCIONALIDAD)", async () => {
    stubSecapi(() => respuestaSecapi("GRANTED", "ROL_FUNCIONALIDAD"));

    const r = await requireRoot(solicitud(token("jgomez")));

    assert.equal(r.ok, true);
  });

  it("devuelve 403 al que no es root (secapi responde DENIED)", async () => {
    stubSecapi(() => respuestaSecapi("DENIED", "ACCESS_DENIED"));

    const r = await requireRoot(solicitud(token("usuario.comun")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 403);
    assert.equal(r.code, "NO_ROOT");
  });

  it("con secapi caído deniega — fail-closed, no abre", async () => {
    stubSecapi(() => {
      throw new Error("ECONNREFUSED");
    });

    const r = await requireRoot(solicitud(token("dmedaglia")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 503);
    assert.equal(r.code, "SECAPI_INACCESIBLE");
  });

  it("con secapi devolviendo 500 también deniega", async () => {
    stubSecapi(() => new Response("boom", { status: 500 }));

    const r = await requireRoot(solicitud(token("dmedaglia")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 503);
  });

  // El status HTTP manda sobre el cuerpo: el body de una respuesta de error no
  // es una autorización. Sin este chequeo, cualquiera que pueda responder por
  // secapi con un 403 que diga GRANTED abría el portal.
  for (const status of [400, 401, 403, 404]) {
    it(`un ${status} con permitido:GRANTED en el cuerpo NO abre`, async () => {
      stubSecapi(
        () =>
          new Response(
            JSON.stringify({ resultados: [{ accionKey: "view", permitido: "GRANTED", razon: "ROOT" }] }),
            { status, headers: { "Content-Type": "application/json" } },
          ),
      );

      const r = await requireRoot(solicitud(token("dmedaglia")));

      assert.equal(r.ok, false);
      if (r.ok) return;
      assert.equal(r.status, 403);
    });
  }

  it("un secreto más corto que el mínimo se trata como no configurado", async () => {
    process.env.JWT_SECRET = "corto";
    stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    // Token firmado con ese mismo secreto corto: aun así no debe abrir.
    const tk = jwt.sign({ username: "dmedaglia" }, "corto", { expiresIn: "1h" });
    const r = await requireRoot(solicitud(tk));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 503);
    assert.equal(r.code, "SECRETO_NO_CONFIGURADO");
  });

  it("un GRANTED cacheado no sobrevive a la caída de secapi si nunca hubo respuesta", async () => {
    // El fallo NO se cachea: al request siguiente se vuelve a preguntar.
    const tk = token("dmedaglia");
    const estado = stubSecapi(() => {
      throw new Error("timeout");
    });

    await requireRoot(solicitud(tk));
    await requireRoot(solicitud(tk));

    assert.equal(estado.llamadas, 2);
  });

  it("sin token no consulta a secapi y devuelve 401", async () => {
    const estado = stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    const r = await requireRoot(solicitud(undefined));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 401);
    assert.equal(r.code, "NO_TOKEN");
    assert.equal(estado.llamadas, 0);
  });

  it("cachea el positivo: dos requests con el mismo token = una sola consulta", async () => {
    const tk = token("dmedaglia");
    const estado = stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    await requireRoot(solicitud(tk));
    await requireRoot(solicitud(tk));

    assert.equal(estado.llamadas, 1);
  });

  it("la caché no salva a un token que se vence entre un request y el siguiente", async () => {
    // 1 segundo de vida: el primer request lo cachea como GRANTED, el segundo
    // llega con el token vencido y tiene que rebotar igual.
    const tk = token("dmedaglia", { expiresIn: 1 });
    stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    const primero = await requireRoot(solicitud(tk));
    assert.equal(primero.ok, true);

    await new Promise((r) => setTimeout(r, 1100));

    const segundo = await requireRoot(solicitud(tk));
    assert.equal(segundo.ok, false);
    if (segundo.ok) return;
    assert.equal(segundo.code, "TOKEN_VENCIDO");
  });

  it("una respuesta ilegible de secapi deniega", async () => {
    stubSecapi(() => new Response("<html>proxy</html>", { status: 200 }));

    const r = await requireRoot(solicitud(token("dmedaglia")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 403);
  });

  it("manda a secapi el body que el endpoint /api/db/permisos espera", async () => {
    let bodyEnviado: any = null;
    let urlLlamada = "";
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      urlLlamada = String(url);
      bodyEnviado = JSON.parse(String(init.body));
      return respuestaSecapi("GRANTED", "ROOT");
    }) as unknown as typeof fetch;

    await requireRoot(solicitud(token("dmedaglia")));

    assert.equal(urlLlamada, `${SECAPI}/api/db/permisos`);
    assert.equal(bodyEnviado.AplicacionId, 3);
    assert.deepEqual(bodyEnviado.permisos, [{ ObjetoKey: "docs", AccionKey: "view" }]);
  });
});
