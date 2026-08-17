// Test del gate root del portal de documentación.
//   pnpm test:docs
//
// Corre con el runner de Node (node:test) + tsx. No usa Playwright a propósito:
// esto es una unidad pura, no necesita navegador ni servidor. `fetch` global se
// reemplaza por un doble que simula a secapi.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { limpiarCacheDocs, requireRoot } from "./root-guard";

const fetchReal = globalThis.fetch;

/** JWT de mentira: sólo el payload importa, el guard no verifica la firma. */
function tokenFalso(username: string): string {
  const payload = Buffer.from(JSON.stringify({ username, sistema: "GOYA" })).toString("base64");
  return `xxx.${payload}.yyy`;
}

function solicitud(token?: string) {
  return {
    headers: { get: (n: string) => (n.toLowerCase() === "authorization" && token ? `Bearer ${token}` : null) },
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
  beforeEach(() => limpiarCacheDocs());
  afterEach(() => {
    globalThis.fetch = fetchReal;
  });

  it("deja pasar al root (secapi responde GRANTED)", async () => {
    stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    const r = await requireRoot(solicitud(tokenFalso("dmedaglia")));

    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.usuario.username, "dmedaglia");
    assert.equal(r.usuario.razon, "ROOT");
  });

  it("acepta también el otorgamiento por rol Root (razón ROL_FUNCIONALIDAD)", async () => {
    stubSecapi(() => respuestaSecapi("GRANTED", "ROL_FUNCIONALIDAD"));

    const r = await requireRoot(solicitud(tokenFalso("jgomez")));

    assert.equal(r.ok, true);
  });

  it("devuelve 403 al que no es root (secapi responde DENIED)", async () => {
    stubSecapi(() => respuestaSecapi("DENIED", "ACCESS_DENIED"));

    const r = await requireRoot(solicitud(tokenFalso("usuario.comun")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 403);
    assert.equal(r.code, "NO_ROOT");
  });

  it("con secapi caído deniega — fail-closed, no abre", async () => {
    stubSecapi(() => {
      throw new Error("ECONNREFUSED");
    });

    const r = await requireRoot(solicitud(tokenFalso("dmedaglia")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 503);
    assert.equal(r.code, "SECAPI_INACCESIBLE");
  });

  it("con secapi devolviendo 500 también deniega", async () => {
    stubSecapi(() => new Response("boom", { status: 500 }));

    const r = await requireRoot(solicitud(tokenFalso("dmedaglia")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 503);
  });

  it("un GRANTED cacheado no sobrevive a la caída de secapi si nunca hubo respuesta", async () => {
    // El fallo NO se cachea: al request siguiente se vuelve a preguntar.
    const estado = stubSecapi(() => {
      throw new Error("timeout");
    });

    await requireRoot(solicitud(tokenFalso("dmedaglia")));
    await requireRoot(solicitud(tokenFalso("dmedaglia")));

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
    const estado = stubSecapi(() => respuestaSecapi("GRANTED", "ROOT"));

    await requireRoot(solicitud(tokenFalso("dmedaglia")));
    await requireRoot(solicitud(tokenFalso("dmedaglia")));

    assert.equal(estado.llamadas, 1);
  });

  it("una respuesta ilegible de secapi deniega", async () => {
    stubSecapi(() => new Response("<html>proxy</html>", { status: 200 }));

    const r = await requireRoot(solicitud(tokenFalso("dmedaglia")));

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 403);
  });

  it("manda a secapi el body que el endpoint /api/db/permisos espera", async () => {
    let bodyEnviado: any = null;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      bodyEnviado = JSON.parse(String(init.body));
      return respuestaSecapi("GRANTED", "ROOT");
    }) as unknown as typeof fetch;

    await requireRoot(solicitud(tokenFalso("dmedaglia")));

    assert.equal(bodyEnviado.AplicacionId, 3);
    assert.deepEqual(bodyEnviado.permisos, [{ ObjetoKey: "docs", AccionKey: "view" }]);
  });
});
