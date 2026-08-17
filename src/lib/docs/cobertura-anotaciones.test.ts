// Test antienvejecimiento del catálogo de APIs.
//   pnpm test:docs
//
// El problema que resuelve: `docs/api/openapi.json` se regenera solo, así que
// nunca miente sobre QUÉ endpoints existen — pero un endpoint nuevo aparece con
// el contrato pelado, sin quién lo consume, sin la key que necesita y sin
// ejemplos. Eso sólo lo puede escribir una persona, y las personas se olvidan.
//
// Por eso este test falla cuando aparece un endpoint sin entrada en
// `docs/api/anotaciones.yaml`, con una lista de excepciones explícita
// (`anotaciones-pendientes.ts`) que congela la deuda del día que se escribió:
// arranca verde y falla SÓLO con los nuevos.
//
// La lista de excepciones también se verifica al revés: si sobra una (porque el
// endpoint se anotó o se borró), el test falla y hay que limpiarla. Sin eso, la
// lista se pudre y en un año nadie sabe qué es deuda real.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENDPOINTS_SIN_ANOTAR } from "./anotaciones-pendientes";
import { cargarCatalogo } from "./spec";

const catalogo = cargarCatalogo();
const claves = catalogo.endpoints.map((e) => `${e.metodo} ${e.ruta}`);
const anotados = new Set(
  catalogo.endpoints.filter((e) => e.anotado).map((e) => `${e.metodo} ${e.ruta}`),
);
const excepciones = new Set(ENDPOINTS_SIN_ANOTAR);

describe("cobertura de anotaciones", () => {
  it("todo endpoint nuevo tiene que estar anotado en docs/api/anotaciones.yaml", () => {
    const faltantes = claves.filter((k) => !anotados.has(k) && !excepciones.has(k));
    assert.deepEqual(
      faltantes,
      [],
      "Estos endpoints no tienen entrada en docs/api/anotaciones.yaml:\n" +
        faltantes.map((k) => `  · ${k}`).join("\n") +
        "\n\nAgregá la entrada (ver docs/api/README.md). Si de verdad no corresponde " +
        "documentarlo, sumalo a src/lib/docs/anotaciones-pendientes.ts explicando por qué.",
    );
  });

  it("la lista de excepciones no tiene entradas que sobren", () => {
    const sobrantes = ENDPOINTS_SIN_ANOTAR.filter((k) => !claves.includes(k) || anotados.has(k));
    assert.deepEqual(
      sobrantes,
      [],
      "Estas excepciones ya no corresponden (el endpoint se anotó o dejó de existir):\n" +
        sobrantes.map((k) => `  · ${k}`).join("\n") +
        "\n\nSacalas de src/lib/docs/anotaciones-pendientes.ts.",
    );
  });

  it("no hay anotaciones que apunten a un endpoint inexistente", () => {
    assert.deepEqual(
      catalogo.huerfanas,
      [],
      "Estas keys de docs/api/anotaciones.yaml no matchean ningún endpoint del " +
        "openapi.json (¿cambió el path?):\n" +
        catalogo.huerfanas.map((k) => `  · ${k}`).join("\n"),
    );
  });

  it("los endpoints con consumidor externo están anotados sí o sí", () => {
    // Los contratos con terceros son los que no pueden quedar sin documentar:
    // del otro lado hay código que no está en este repo (el VB6, el shell del
    // mostrador, TrackMovil, el QR impreso).
    const obligatorios = [
      "GET /api/calles/buscar",
      "GET /api/calles/esquinas",
      "GET /api/calles/resolver",
      "GET /api/calles/estado",
      "POST /api/zonas/sync/webhook",
      "POST /api/mostrador/sesion",
      "GET /api/mostrador/ficha/{cliid}",
      "POST /api/mostrador/ficha/{cliid}",
      "GET /api/sorteos/publico/estado",
      "POST /api/sorteos/publico/participar",
      "POST /api/sorteo-publico/participar",
    ];
    const sinAnotar = obligatorios.filter((k) => !anotados.has(k));
    assert.deepEqual(sinAnotar, [], `Sin anotar: ${sinAnotar.join(", ")}`);
  });

  it("todo endpoint anotado declara auth y consumidores", () => {
    const incompletos = catalogo.endpoints
      .filter((e) => e.anotado)
      .filter((e) => e.auth === "sin declarar" || e.consumidores.length === 0)
      .map((e) => `${e.metodo} ${e.ruta}`);
    assert.deepEqual(
      incompletos,
      [],
      `Anotados a medias (falta auth o consumidores): ${incompletos.join(", ")}`,
    );
  });
});
