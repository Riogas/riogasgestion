// Tests de los ejemplos copiables.
//   pnpm test:docs
//
// Lo que se fija: que el host salga SIEMPRE del origen que se pasa (nunca una
// IP ni un host de dev hardcodeado), que el ejemplo VB6 aparezca sólo donde hay
// un VB6 del otro lado, y que el ambiente se derive del host tratando lo
// desconocido como producción.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VALORES_VACIOS,
  ambienteDeHost,
  ejemploCurl,
  ejemploFetch,
  ejemploVb6,
  ejemplosDe,
  reemplazarOrigen,
  rutaConParams,
  usaVb6,
  variableDeKey,
} from "./ejemplos";
import type { EndpointVista } from "./vista";

function endpoint(parcial: Partial<EndpointVista> = {}): EndpointVista {
  return {
    id: "get-api-calles-buscar",
    metodo: "GET",
    ruta: "/api/calles/buscar",
    modulo: "calles",
    resumen: "",
    descripcion: "",
    auth: "x-api-key (CALLES_API_KEY)",
    categoriaAuth: "api-key",
    consumidores: ["VB6 (alta de direcciones)"],
    notas: "",
    origen: "",
    archivo: "",
    anotado: true,
    esEscritura: false,
    parametros: [],
    cuerpo: null,
    respuestas: [],
    errores: [],
    ejemplos: [],
    busqueda: "",
    ...parcial,
  };
}

const ORIGEN = "https://goya.riogas.com.uy";

describe("ambienteDeHost", () => {
  it("trata lo desconocido como PRODUCCIÓN", () => {
    assert.deepEqual(ambienteDeHost("goya.riogas.com.uy"), {
      nombre: "PRODUCCIÓN",
      esProd: true,
      host: "goya.riogas.com.uy",
    });
    assert.equal(ambienteDeHost("").esProd, true);
  });

  it("reconoce dev y local", () => {
    assert.equal(ambienteDeHost("goya-dev.glp.riogas.com.uy").nombre, "DEV");
    assert.equal(ambienteDeHost("goya-dev.glp.riogas.com.uy").esProd, false);
    assert.equal(ambienteDeHost("localhost:4000").nombre, "LOCAL");
    assert.equal(ambienteDeHost("127.0.0.1:3000").esProd, false);
  });
});

describe("rutaConParams", () => {
  it("sustituye lo que tiene valor y deja lo que falta", () => {
    assert.equal(rutaConParams("/api/clientes/{id}", { id: "123" }), "/api/clientes/123");
    assert.equal(rutaConParams("/api/clientes/{id}", {}), "/api/clientes/{id}");
  });

  it("no rompe el path con un valor raro", () => {
    assert.equal(rutaConParams("/api/x/{id}", { id: "a b" }), "/api/x/a%20b");
  });
});

describe("ejemplos", () => {
  it("el curl usa el origen que se le pasa, no una IP ni un host fijo", () => {
    const codigo = ejemploCurl(endpoint(), ORIGEN, VALORES_VACIOS);
    assert.ok(codigo.includes(`${ORIGEN}/api/calles/buscar`), codigo);
    assert.ok(!/\d+\.\d+\.\d+\.\d+/.test(codigo), "no puede haber una IP en el ejemplo");
    assert.ok(codigo.includes("x-api-key: $CALLES_API_KEY"), codigo);
  });

  it("el curl arma la query y el cuerpo de una escritura", () => {
    const ep = endpoint({
      metodo: "POST",
      ruta: "/api/zonas",
      esEscritura: true,
      categoriaAuth: "jwt",
      auth: "JWT (Bearer)",
      cuerpo: {
        requerido: true,
        contentType: "application/json",
        schemaNombre: "CreateZonaDto",
        descripcion: "",
        campos: [],
        esqueleto: '{\n  "nombre": ""\n}',
      },
    });
    const codigo = ejemploCurl(ep, ORIGEN, { ...VALORES_VACIOS, query: { puestoId: "7" } });
    assert.ok(codigo.includes("-X POST"), codigo);
    assert.ok(codigo.includes("Authorization: Bearer $TOKEN"), codigo);
    assert.ok(codigo.includes("?puestoId=7"), codigo);
    assert.ok(codigo.includes('"nombre": ""'), codigo);
  });

  it("el fetch lee texto cuando el formato es texto y json en el resto", () => {
    const conTexto = ejemploFetch(endpoint(), ORIGEN, { ...VALORES_VACIOS, query: { formato: "texto" } });
    assert.ok(conTexto.includes("resp.text()"), conTexto);
    const conJson = ejemploFetch(endpoint({ resumen: "" }), ORIGEN, VALORES_VACIOS);
    assert.ok(conJson.includes("resp.json()"), conJson);
  });

  it("el VB6 sale sólo si hay un VB6 del otro lado", () => {
    assert.equal(usaVb6(endpoint()), true);
    assert.equal(usaVb6(endpoint({ consumidores: ["Pantalla /dashboard/zonas"] })), false);

    const claves = ejemplosDe(endpoint(), ORIGEN).map((e) => e.clave);
    assert.deepEqual(claves, ["curl", "fetch", "vb6"]);

    const sinVb6 = ejemplosDe(endpoint({ consumidores: [] }), ORIGEN).map((e) => e.clave);
    assert.deepEqual(sinVb6, ["curl", "fetch"]);
  });

  it("el ejemplo VB6 usa ServerXMLHTTP y parsea el pipe cuando corresponde", () => {
    const codigo = ejemploVb6(endpoint(), ORIGEN, { ...VALORES_VACIOS, query: { formato: "texto" } });
    assert.ok(codigo.includes('CreateObject("MSXML2.ServerXMLHTTP.6.0")'), codigo);
    assert.ok(codigo.includes(`http.Open "GET", "${ORIGEN}/api/calles/buscar?formato=texto", False`), codigo);
    assert.ok(codigo.includes('Split(filas(i), "|")'), codigo);
    assert.ok(codigo.includes("http.setRequestHeader \"x-api-key\", CALLES_API_KEY"), codigo);
  });

  it("los ejemplos escritos a mano resuelven el placeholder {origen}", () => {
    const ep = endpoint({
      ejemplos: [{ titulo: "curl a mano", lenguaje: "bash", codigo: "curl {origen}/api/calles/estado" }],
    });
    const anotado = ejemplosDe(ep, ORIGEN).find((e) => e.clave === "anotado-0")!;
    assert.equal(anotado.codigo, `curl ${ORIGEN}/api/calles/estado`);
    assert.equal(reemplazarOrigen("{origen}/x", "http://localhost:4000"), "http://localhost:4000/x");
  });

  it("saca el nombre de la variable de entorno del texto de auth", () => {
    assert.equal(variableDeKey(endpoint()), "CALLES_API_KEY");
    assert.equal(variableDeKey(endpoint({ auth: "x-api-key (SyncApiKeyGuard)" })), "ZONAS_SYNC_API_KEY");
    assert.equal(variableDeKey(endpoint({ auth: "x-api-key" })), "API_KEY");
  });
});
