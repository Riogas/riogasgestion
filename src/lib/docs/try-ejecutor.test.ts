// Tests del "probar" del portal de documentación.
//   pnpm test:docs
//
// Lo que se fija acá es que /api/docs/try NUNCA sea un proxy abierto y que no
// dispare una escritura sin confirmación explícita. Los casos de rechazo se
// verifican SIEMPRE con dos aserciones: el status/código, y que el fetch al
// destino no se haya llamado ni una vez.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { limpiarCacheDocs } from "./root-guard";
import {
  ENV_ORIGEN,
  LIMITE_RESPUESTA_BYTES,
  PUERTO_POR_DEFECTO,
  filtrarHeaders,
  manejarTry,
  resolverOrigenConfiable,
  validarPath,
} from "./try-ejecutor";

const SECRETO = "secreto-de-test-no-el-de-produccion";
const SECAPI = "https://secapi.test";
const ORIGEN = "https://goya-dev.glp.riogas.com.uy";
const HOST_DE_ENTRADA = new URL(ORIGEN).host;
/** Entorno por defecto de los tests: el destino sale de la env, nunca de un header. */
const ENV = { [ENV_ORIGEN]: ORIGEN } as Record<string, string | undefined>;

const fetchReal = globalThis.fetch;
const envOriginal = { JWT_SECRET: process.env.JWT_SECRET, SECAPI_URL: process.env.SECAPI_URL };

function tokenValido(): string {
  return jwt.sign({ username: "dmedaglia", sistema: "GOYA" }, SECRETO, { expiresIn: "1h" });
}

function solicitud(tk: string = tokenValido()) {
  return {
    headers: { get: (n: string) => (n.toLowerCase() === "authorization" ? `Bearer ${tk}` : null) },
    cookies: { get: () => undefined },
  };
}

/** Guard que dice que sí, para los tests que no son del guard. */
const rootOk = async () => ({ ok: true as const, usuario: { username: "dmedaglia", razon: "ROOT" } });

/** Doble del fetch al destino: registra las llamadas y devuelve lo que se le pida. */
function espiaFetch(respuesta: () => Response = () => new Response("{}", { status: 200 })) {
  const llamadas: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: unknown, init: unknown) => {
    llamadas.push({ url: String(url), init: (init ?? {}) as RequestInit });
    return respuesta();
  }) as unknown as typeof fetch;
  return { llamadas, impl };
}

/** El pedido va en base64: es lo que le permite atravesar el WAF. */
function payload(pedido: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(pedido), "utf8").toString("base64");
}

async function ejecutar(pedido: Record<string, unknown>, opciones: Record<string, unknown> = {}) {
  const espia = espiaFetch((opciones.respuesta as (() => Response) | undefined) ?? undefined);
  const salida = await manejarTry({
    solicitud: (opciones.solicitud as ReturnType<typeof solicitud>) ?? solicitud(),
    cuerpo: { payload: payload(pedido), ...((opciones.extra as object) ?? {}) },
    env: (opciones.env as Record<string, string | undefined> | undefined) ?? ENV,
    origenDelNavegador: (opciones.origenNavegador as string | null) ?? null,
    // `?? ` no sirve: hay un caso que necesita pasar null explícito.
    hostDelRequest: "hostDelRequest" in opciones
      ? (opciones.hostDelRequest as string | null)
      : HOST_DE_ENTRADA,
    fetchImpl: espia.impl,
    verificarRoot: (opciones.verificarRoot as typeof rootOk) ?? rootOk,
  });
  return { salida, llamadas: espia.llamadas };
}

describe("validarPath", () => {
  it("acepta rutas internas de la API", () => {
    assert.deepEqual(validarPath("/api/clientes/123"), { ok: true, path: "/api/clientes/123" });
  });

  it("rechaza todo lo que apunte afuera de /api/", () => {
    for (const malo of ["/dashboard/docs", "/", "/apix/clientes", "api/clientes", "/health"]) {
      const r = validarPath(malo);
      assert.equal(r.ok, false, `debería rechazar ${malo}`);
      if (!r.ok) assert.equal(r.code, "PATH_INVALIDO");
    }
  });

  it("rechaza URL absolutas y protocol-relative", () => {
    for (const malo of [
      "https://evil.example/api/x",
      "HTTP://evil.example/api/x",
      "javascript:alert(1)",
      "//evil.example/api/x",
      "/api//evil.example/x",
    ]) {
      assert.equal(validarPath(malo).ok, false, `debería rechazar ${malo}`);
    }
  });

  it("rechaza traversal literal y codificado", () => {
    for (const malo of ["/api/../etc/passwd", "/api/clientes/..%2f..", "/api/%2e%2e/secreto", "/api/%2E%2E/x"]) {
      assert.equal(validarPath(malo).ok, false, `debería rechazar ${malo}`);
    }
  });

  it("rechaza query pegada al path, espacios y el propio /api/docs/try", () => {
    assert.equal(validarPath("/api/clientes?id=1").ok, false);
    assert.equal(validarPath("/api/clientes 1").ok, false);
    assert.equal(validarPath("/api/docs/try").ok, false);
  });
});

describe("recursión", () => {
  // `validarPath` bloquea el self-path por TEXTO, pero `new URL` resuelve los
  // segmentos punto (RFC 3986): "/api/docs/./try" pasa el filtro textual y
  // aterriza igual en "/api/docs/try". Quien decide es el chequeo posterior,
  // sobre el pathname ya resuelto — el mismo criterio que se usa con el origen.
  for (const path of ["/api/docs/./try", "/api/./docs/try", "/api/docs/./try/"]) {
    it(`no se llama a sí mismo con ${path}`, async () => {
      const { salida, llamadas } = await ejecutar({ metodo: "GET", path });
      assert.equal(salida.status, 400);
      assert.equal((salida.cuerpo as { error: string }).error, "PATH_INVALIDO");
      assert.equal(llamadas.length, 0);
    });
  }
});

describe("resolverOrigenConfiable", () => {
  it("usa DOCS_TRY_ORIGEN tal cual cuando está", () => {
    const r = resolverOrigenConfiable({ [ENV_ORIGEN]: ORIGEN, PORT: "3000" });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.origen.origin, ORIGEN);
      assert.equal(r.fuente, "env");
    }
  });

  it("normaliza DOCS_TRY_ORIGEN a esquema+host+puerto (sin path ni credenciales)", () => {
    const r = resolverOrigenConfiable({ [ENV_ORIGEN]: "http://usuario:clave@127.0.0.1:4000/api/?x=1" });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.origen.origin, "http://127.0.0.1:4000");
  });

  it("sin la env cae al loopback del PORT del proceso", () => {
    const r = resolverOrigenConfiable({ PORT: "4000" });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.origen.origin, "http://127.0.0.1:4000");
      assert.equal(r.fuente, "loopback");
    }
  });

  it("sin env y sin PORT usa el puerto por defecto de Next", () => {
    const r = resolverOrigenConfiable({});
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.origen.origin, `http://127.0.0.1:${PUERTO_POR_DEFECTO}`);
  });

  it("no acepta un origen que no sea http(s) ni una env basura", () => {
    for (const malo of ["no-es-una-url", "file:///etc/passwd", "ftp://host", "//evil.example", "javascript:alert(1)"]) {
      const r = resolverOrigenConfiable({ [ENV_ORIGEN]: malo });
      assert.equal(r.ok, false, `debería rechazar ${malo}`);
      if (!r.ok) {
        assert.equal(r.status, 503);
        assert.equal(r.code, "ORIGEN_NO_CONFIGURADO");
      }
    }
  });

  it("no adivina si PORT no es un puerto", () => {
    for (const malo of ["abc", "0", "70000", "3000; rm -rf /"]) {
      const r = resolverOrigenConfiable({ PORT: malo });
      assert.equal(r.ok, false, `debería rechazar PORT=${malo}`);
      if (!r.ok) assert.equal(r.code, "ORIGEN_NO_CONFIGURADO");
    }
  });
});

describe("filtrarHeaders", () => {
  it("descarta los headers de credenciales y de ruteo", () => {
    const { headers, descartados } = filtrarHeaders({
      Authorization: "Bearer robado",
      Cookie: "token=robado",
      Host: "evil.example",
      "X-Forwarded-For": "1.2.3.4",
      "x-api-key": "la-key-de-verdad",
      "Content-Type": "application/json",
    });
    assert.deepEqual(Object.keys(headers).sort(), ["Content-Type", "x-api-key"]);
    assert.deepEqual(descartados.sort(), ["Authorization", "Cookie", "Host", "X-Forwarded-For"]);
  });

  it("descarta valores con salto de línea (inyección de headers)", () => {
    const { headers } = filtrarHeaders({ "X-Algo": "valor\r\nX-Inyectado: si" });
    assert.deepEqual(headers, {});
  });
});

describe("manejarTry", () => {
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

  // ── Gate ─────────────────────────────────────────────────────────────────

  it("sin ser root devuelve 403 y no ejecuta nada", async () => {
    // Guard REAL contra un secapi que contesta DENIED: el token está bien
    // firmado, lo que falta es el permiso.
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ resultados: [{ accionKey: "view", permitido: "DENIED", razon: "SIN_PERMISO" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    const espia = espiaFetch();
    const salida = await manejarTry({
      solicitud: solicitud(),
      cuerpo: { payload: payload({ metodo: "GET", path: "/api/clientes" }) },
      env: ENV,
      fetchImpl: espia.impl,
    });

    assert.equal(salida.status, 403);
    assert.equal(salida.cuerpo.error, "NO_ROOT");
    assert.equal(espia.llamadas.length, 0);
  });

  it("sin token devuelve 401 y no ejecuta nada", async () => {
    const espia = espiaFetch();
    const salida = await manejarTry({
      solicitud: { headers: { get: () => null }, cookies: { get: () => undefined } },
      cuerpo: { payload: payload({ metodo: "GET", path: "/api/clientes" }) },
      env: ENV,
      fetchImpl: espia.impl,
    });
    assert.equal(salida.status, 401);
    assert.equal(salida.cuerpo.error, "NO_TOKEN");
    assert.equal(espia.llamadas.length, 0);
  });

  // ── Destino ──────────────────────────────────────────────────────────────

  it("rechaza un path fuera de /api sin llamar al destino", async () => {
    const { salida, llamadas } = await ejecutar({ metodo: "GET", path: "/dashboard/docs" });
    assert.equal(salida.status, 400);
    assert.equal(salida.cuerpo.error, "PATH_INVALIDO");
    assert.equal(llamadas.length, 0);
  });

  it("rechaza una URL absoluta sin llamar al destino", async () => {
    const { salida, llamadas } = await ejecutar({ metodo: "GET", path: "https://evil.example/api/robar" });
    assert.equal(salida.status, 400);
    assert.equal(salida.cuerpo.error, "PATH_INVALIDO");
    assert.equal(llamadas.length, 0);
  });

  it("rechaza el traversal sin llamar al destino", async () => {
    const { salida, llamadas } = await ejecutar({ metodo: "GET", path: "/api/%2e%2e/etc/passwd" });
    assert.equal(salida.status, 400);
    assert.equal(salida.cuerpo.error, "PATH_INVALIDO");
    assert.equal(llamadas.length, 0);
  });

  it("rechaza un método que no está en la lista", async () => {
    const { salida, llamadas } = await ejecutar({ metodo: "TRACE", path: "/api/clientes" });
    assert.equal(salida.status, 400);
    assert.equal(salida.cuerpo.error, "METODO_NO_PERMITIDO");
    assert.equal(llamadas.length, 0);
  });

  it("rechaza un Origin de otro host (anti-CSRF)", async () => {
    const { salida, llamadas } = await ejecutar(
      { metodo: "GET", path: "/api/clientes" },
      { origenNavegador: "https://evil.example" },
    );
    assert.equal(salida.status, 403);
    assert.equal(salida.cuerpo.error, "ORIGEN_INVALIDO");
    assert.equal(llamadas.length, 0);
  });

  it("acepta el Origin que coincide con el host por el que entró el request", async () => {
    const { salida, llamadas } = await ejecutar(
      { metodo: "GET", path: "/api/clientes" },
      { origenNavegador: ORIGEN, hostDelRequest: HOST_DE_ENTRADA },
    );
    assert.equal(salida.status, 200);
    assert.equal(llamadas.length, 1);
  });

  it("con Origin pero sin poder saber el host de entrada, no ejecuta", async () => {
    const { salida, llamadas } = await ejecutar(
      { metodo: "GET", path: "/api/clientes" },
      { origenNavegador: ORIGEN, hostDelRequest: null },
    );
    assert.equal(salida.status, 403);
    assert.equal(salida.cuerpo.error, "ORIGEN_INVALIDO");
    assert.equal(llamadas.length, 0);
  });

  // ── El destino NO sale de ningún header (SSRF) ───────────────────────────
  // Host / x-forwarded-host los elige quien manda el request, y la llamada sale
  // con el Authorization y la Cookie del root: si el destino saliera de ahí,
  // esto sería un SSRF que además exfiltra el JWT.

  it("ningún host del request cambia el destino del fetch", async () => {
    for (const hostAtacante of [
      "evil.example.com",
      "169.254.169.254",
      "localhost:5432",
      "127.0.0.1:22",
      "goya-prod.glp.riogas.com.uy",
    ]) {
      const { salida, llamadas } = await ejecutar(
        { metodo: "GET", path: "/api/clientes" },
        // El navegador manda un Origin coherente con el host falsificado: ni
        // así el fetch se mueve del origen de confianza.
        { hostDelRequest: hostAtacante, origenNavegador: `https://${hostAtacante}` },
      );
      assert.equal(salida.status, 200, `con host ${hostAtacante}`);
      assert.equal(llamadas.length, 1, `con host ${hostAtacante}`);
      assert.equal(llamadas[0].url, `${ORIGEN}/api/clientes`, `con host ${hostAtacante}`);
    }
  });

  it("sin DOCS_TRY_ORIGEN el destino es el loopback de este proceso, no el host del request", async () => {
    const { salida, llamadas } = await ejecutar(
      { metodo: "GET", path: "/api/clientes" },
      {
        env: { PORT: "3000" },
        hostDelRequest: "evil.example.com",
        origenNavegador: "https://evil.example.com",
      },
    );
    assert.equal(salida.status, 200);
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].url, "http://127.0.0.1:3000/api/clientes");
  });

  it("con DOCS_TRY_ORIGEN el destino es ese y sólo ese", async () => {
    const { llamadas } = await ejecutar(
      { metodo: "GET", path: "/api/clientes", query: { q: "x" } },
      {
        env: { [ENV_ORIGEN]: "http://127.0.0.1:4000", PORT: "9999" },
        hostDelRequest: "goya-prod.glp.riogas.com.uy",
      },
    );
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].url, "http://127.0.0.1:4000/api/clientes?q=x");
  });

  it("con el origen mal configurado devuelve 503 y no ejecuta nada", async () => {
    const { salida, llamadas } = await ejecutar(
      { metodo: "GET", path: "/api/clientes" },
      { env: { [ENV_ORIGEN]: "no-es-una-url" }, hostDelRequest: HOST_DE_ENTRADA },
    );
    assert.equal(salida.status, 503);
    assert.equal(salida.cuerpo.error, "ORIGEN_NO_CONFIGURADO");
    assert.equal(llamadas.length, 0);
  });

  it("revalida contra el entorno y no contra la base con la que armó la URL", async () => {
    // Entorno que devuelve un origen distinto en la segunda lectura. Es la
    // única forma de probar que la revalidación final NO es autorreferencial:
    // si comparara la URL armada contra la misma base que la armó, este caso
    // pasaría igual.
    let lecturas = 0;
    const envQueCambia = new Proxy({} as Record<string, string | undefined>, {
      get(_objetivo, propiedad) {
        if (propiedad === ENV_ORIGEN) {
          lecturas += 1;
          return lecturas === 1 ? ORIGEN : "https://evil.example";
        }
        return undefined;
      },
    });

    const { salida, llamadas } = await ejecutar(
      { metodo: "GET", path: "/api/clientes" },
      { env: envQueCambia },
    );
    assert.equal(salida.status, 400);
    assert.equal(salida.cuerpo.error, "DESTINO_NO_PERMITIDO");
    assert.equal(llamadas.length, 0);
  });

  it("rechaza un path con barra invertida sin llamar al destino", async () => {
    const { salida, llamadas } = await ejecutar({ metodo: "GET", path: "/api/\\evil.example/x" });
    assert.equal(salida.status, 400);
    assert.equal(salida.cuerpo.error, "PATH_INVALIDO");
    assert.equal(llamadas.length, 0);
  });

  // ── Escrituras ───────────────────────────────────────────────────────────

  it("una escritura sin confirmación devuelve 428 y no ejecuta nada", async () => {
    const { salida, llamadas } = await ejecutar({
      metodo: "POST",
      path: "/api/zonas",
      body: { nombre: "Centro" },
    });
    assert.equal(salida.status, 428);
    assert.equal(salida.cuerpo.error, "CONFIRMACION_REQUERIDA");
    assert.equal(salida.cuerpo.path, "/api/zonas");
    assert.equal(llamadas.length, 0);
  });

  it("una confirmación que no es el path exacto también devuelve 428", async () => {
    const { salida, llamadas } = await ejecutar({
      metodo: "DELETE",
      path: "/api/zonas/7",
      confirmacion: "/api/zonas",
    });
    assert.equal(salida.status, 428);
    assert.equal(llamadas.length, 0);
  });

  it("con la confirmación correcta ejecuta la escritura", async () => {
    const { salida, llamadas } = await ejecutar({
      metodo: "POST",
      path: "/api/zonas",
      confirmacion: "/api/zonas",
      body: { nombre: "Centro" },
    });
    assert.equal(salida.status, 200);
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].url, `${ORIGEN}/api/zonas`);
    assert.equal(llamadas[0].init.method, "POST");
    assert.equal(llamadas[0].init.body, JSON.stringify({ nombre: "Centro" }));
  });

  it("acepta la confirmación por afuera del payload (lo que manda el diálogo)", async () => {
    const { salida, llamadas } = await ejecutar(
      { metodo: "PATCH", path: "/api/zonas/7", body: { nombre: "Centro" } },
      { extra: { confirmacion: "/api/zonas/7" } },
    );
    assert.equal(salida.status, 200);
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].init.method, "PATCH");
  });

  // ── Lecturas ─────────────────────────────────────────────────────────────

  it("un GET se ejecuta directo, con query y con la sesión del root", async () => {
    const { salida, llamadas } = await ejecutar(
      {
        metodo: "GET",
        path: "/api/calles/buscar",
        query: { q: "rivera", formato: "texto" },
        headers: { "x-api-key": "la-key", Authorization: "Bearer robado", Cookie: "token=robado" },
      },
      {
        respuesta: () =>
          new Response("123|RIVERA|MONTEVIDEO", {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": "text/plain" },
          }),
      },
    );

    assert.equal(salida.status, 200);
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].url, `${ORIGEN}/api/calles/buscar?q=rivera&formato=texto`);

    const headers = llamadas[0].init.headers as Record<string, string>;
    // La key del cliente pasa; el Authorization/Cookie los pone el servidor.
    assert.equal(headers["x-api-key"], "la-key");
    assert.match(headers.Authorization, /^Bearer eyJ/);
    assert.notEqual(headers.Authorization, "Bearer robado");
    assert.notEqual(headers.Cookie, "token=robado");

    const cuerpo = salida.cuerpo as unknown as { status: number; body: string; truncado: boolean };
    assert.equal(cuerpo.status, 200);
    assert.equal(cuerpo.body, "123|RIVERA|MONTEVIDEO");
    assert.equal(cuerpo.truncado, false);
    assert.equal(typeof (salida.cuerpo as { duracionMs: number }).duracionMs, "number");
  });

  it("no manda cuerpo en un GET aunque el payload lo traiga", async () => {
    const { llamadas } = await ejecutar({ metodo: "GET", path: "/api/clientes", body: { a: 1 } });
    assert.equal(llamadas[0].init.body, undefined);
  });

  it("trunca la respuesta a 1 MB y lo avisa", async () => {
    const gigante = "x".repeat(LIMITE_RESPUESTA_BYTES + 5000);
    const { salida } = await ejecutar(
      { metodo: "GET", path: "/api/sorteos" },
      { respuesta: () => new Response(gigante, { status: 200 }) },
    );
    const cuerpo = salida.cuerpo as unknown as { body: string; truncado: boolean };
    assert.equal(cuerpo.truncado, true);
    assert.equal(cuerpo.body.length, LIMITE_RESPUESTA_BYTES);
  });

  it("devuelve el status real del destino sin interpretarlo", async () => {
    const { salida } = await ejecutar(
      { metodo: "GET", path: "/api/clientes" },
      { respuesta: () => new Response('{"error":"Token ausente"}', { status: 401, statusText: "Unauthorized" }) },
    );
    const cuerpo = salida.cuerpo as unknown as { status: number; body: string };
    assert.equal(salida.status, 200); // el try funcionó…
    assert.equal(cuerpo.status, 401); // …y el destino contestó 401
    assert.equal(cuerpo.body, '{"error":"Token ausente"}');
  });

  // ── Payload ──────────────────────────────────────────────────────────────

  it("rechaza un payload que no es base64 de un JSON objeto", async () => {
    for (const cuerpo of [{}, { payload: "" }, { payload: "no-es-base64-de-json" }, { payload: Buffer.from('"texto"').toString("base64") }]) {
      const espia = espiaFetch();
      const salida = await manejarTry({
        solicitud: solicitud(),
        cuerpo,
        env: ENV,
        fetchImpl: espia.impl,
        verificarRoot: rootOk,
      });
      assert.equal(salida.status, 400);
      assert.equal(salida.cuerpo.error, "PAYLOAD_INVALIDO");
      assert.equal(espia.llamadas.length, 0);
    }
  });

  it("un cuerpo con sintaxis de shell viaja entero (es para lo que está el base64)", async () => {
    const cuerpoConShell = '{"nombre":"$(rm -rf /) `id` && curl evil"}';
    const { salida, llamadas } = await ejecutar({
      metodo: "POST",
      path: "/api/zonas",
      confirmacion: "/api/zonas",
      body: cuerpoConShell,
    });
    assert.equal(salida.status, 200);
    assert.equal(llamadas[0].init.body, cuerpoConShell);
  });
});
