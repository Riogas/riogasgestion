// Tests del modelo de vista del portal.
//   pnpm test:docs
//
// El foco está en la clasificación de autenticación, porque es lo que decide
// qué se pinta en rojo en la pantalla: equivocarse en un sentido asusta de
// gusto, y en el otro esconde un endpoint abierto.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cargarCatalogo } from "./spec";
import { clasificarAuth, construirVista, erroresDelGuard, esSinValidacion, idEndpoint, normalizar } from "./vista";

describe("clasificarAuth", () => {
  it("agrupa las variantes de texto de cada guard", () => {
    assert.equal(clasificarAuth("x-api-key (CallesApiKeyGuard)"), "api-key");
    assert.equal(clasificarAuth("x-api-key"), "api-key");
    assert.equal(clasificarAuth("JWT (Bearer)"), "jwt");
    assert.equal(clasificarAuth("JWT (cookie token)"), "jwt");
    assert.equal(clasificarAuth("guard SesionMostradorGuard"), "sesion");
    assert.equal(clasificarAuth("ninguna (sin guard)"), "ninguna");
    assert.equal(clasificarAuth("JWT + permiso docs:view en GOYA"), "root");
    assert.equal(clasificarAuth(""), "otra");
  });

  it("la categoría declarada a mano le gana a la heurística", () => {
    // El caso real: el handler menciona x-api-key porque la agrega ÉL hacia el
    // backend; para el navegador el endpoint es público.
    assert.equal(clasificarAuth("x-api-key", "publica"), "publica");
    assert.equal(clasificarAuth("ninguna en el proxy", "delegada"), "delegada");
    // Una categoría inventada se ignora y manda la heurística.
    assert.equal(clasificarAuth("JWT (Bearer)", "inventada"), "jwt");
  });

  it("marca como sin validación propia a ninguna, publica y delegada", () => {
    assert.equal(esSinValidacion("ninguna"), true);
    assert.equal(esSinValidacion("publica"), true);
    assert.equal(esSinValidacion("delegada"), true);
    assert.equal(esSinValidacion("jwt"), false);
    assert.equal(esSinValidacion("api-key"), false);
  });
});

describe("erroresDelGuard", () => {
  it("le pone al endpoint los 401 que tira el guard y no declara ninguna operación", () => {
    const jwt = erroresDelGuard("jwt");
    assert.ok(jwt.some((e) => e.cuerpo === "Token expirado"));
    assert.ok(jwt.every((e) => e.codigo === "401"));
    assert.ok(erroresDelGuard("api-key").some((e) => e.cuerpo === "Falta header x-api-key"));
    assert.ok(erroresDelGuard("root").some((e) => e.codigo === "503"));
    assert.deepEqual(erroresDelGuard("publica"), []);
  });
});

describe("helpers", () => {
  it("el id del endpoint sirve de ancla", () => {
    assert.equal(idEndpoint("GET", "/api/clientes/{id}"), "get-api-clientes-id");
    assert.equal(idEndpoint("POST", "/api/zonas/sync/webhook"), "post-api-zonas-sync-webhook");
  });

  it("normalizar saca acentos para que la búsqueda no dependa de tildes", () => {
    assert.equal(normalizar("Geolocalización ACÁ"), "geolocalizacion aca");
  });
});

describe("construirVista sobre el catálogo real", () => {
  const vista = construirVista(cargarCatalogo());

  it("aplana todos los endpoints con módulo y categoría", () => {
    assert.ok(vista.endpoints.length > 100, `esperaba más de 100, hay ${vista.endpoints.length}`);
    assert.ok(vista.modulos.length > 10);
    for (const e of vista.endpoints) {
      assert.ok(e.id, `sin id: ${e.metodo} ${e.ruta}`);
      assert.ok(e.modulo, `sin módulo: ${e.metodo} ${e.ruta}`);
      assert.ok(e.busqueda.includes(normalizar(e.ruta)), `sin texto de búsqueda: ${e.ruta}`);
    }
  });

  it("los ids son únicos (si no, el deep link abre otro endpoint)", () => {
    const ids = new Set(vista.endpoints.map((e) => e.id));
    assert.equal(ids.size, vista.endpoints.length);
  });

  it("el resumen de auth cuenta todo el catálogo sin perder ni duplicar", () => {
    const suma = vista.resumen.porCategoria.reduce((acc, c) => acc + c.cantidad, 0);
    assert.equal(suma, vista.endpoints.length);
    assert.equal(vista.resumen.total, vista.endpoints.length);
  });

  it("levanta las advertencias transversales del yaml", () => {
    assert.ok(vista.resumen.advertencias.length >= 3);
    assert.ok(vista.resumen.advertencias.every((a) => a.titulo && a.detalle));
  });

  it("el endpoint del VB6 llega con parámetros, ejemplo y consumidores", () => {
    const buscar = vista.endpoints.find((e) => e.metodo === "GET" && e.ruta === "/api/calles/buscar");
    assert.ok(buscar, "falta GET /api/calles/buscar");
    assert.equal(buscar!.categoriaAuth, "api-key");
    assert.ok(buscar!.parametros.some((p) => p.nombre === "q" && p.requerido));
    assert.ok(buscar!.parametros.some((p) => p.opciones.includes("texto")));
    assert.ok(buscar!.consumidores.some((c) => /VB6/.test(c)));
    assert.ok(buscar!.respuestas.some((r) => r.codigo === "200" && r.ejemplo.includes("calid")));
  });

  it("el cuerpo de un POST sale resuelto desde el $ref del schema", () => {
    const alta = vista.endpoints.find((e) => e.metodo === "POST" && e.ruta === "/api/zonas");
    assert.ok(alta?.cuerpo, "POST /api/zonas debería tener cuerpo");
    assert.equal(alta!.cuerpo!.schemaNombre, "CreateZonaDto");
    assert.ok(alta!.cuerpo!.campos.some((c) => c.nombre === "nombre" && c.requerido));
    assert.ok(alta!.cuerpo!.esqueleto.includes("poligono"));
  });

  it("no quedan anotaciones huérfanas", () => {
    assert.deepEqual(vista.huerfanas, []);
  });
});
