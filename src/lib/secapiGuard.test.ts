// Estos tests fijan el contrato que la primera ronda de arreglos tuvo mal: el
// código del guard de secapi viaja en el header `x-auth-guard`, NO en el body.
// El caso "503 con prosa en el body" es exactamente el que dejaba los ifs del
// 503 como código muerto, y ninguna verificación (tsc/build/tests) lo veía.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  codigoGuardSecapi,
  esSecretoNoConfigurado,
  esUsuarioNoActivoSecapi,
} from "./secapiGuard";

/** Respuesta tal cual la arma `denegar()` en security_suite/src/lib/auth/apiGuard.ts. */
function respuestaDelGuard(code: string, mensajeHumano: string) {
  return {
    headers: new Headers({ "x-auth-guard": code }),
    body: { success: false, error: mensajeHumano },
  };
}

describe("codigoGuardSecapi", () => {
  it("lee el código del header aunque el body traiga prosa", () => {
    const r = respuestaDelGuard(
      "SECRETO_NO_CONFIGURADO",
      "El servidor no está configurado para autorizar esta operación; avisá a sistemas",
    );
    assert.equal(codigoGuardSecapi(r.headers, r.body), "SECRETO_NO_CONFIGURADO");
    assert.equal(esSecretoNoConfigurado(r.headers, r.body), true);
  });

  it("distingue ERROR_GUARD de SECRETO_NO_CONFIGURADO (mismo 503, mismo body)", () => {
    const r = respuestaDelGuard(
      "ERROR_GUARD",
      "El servidor no está configurado para autorizar esta operación; avisá a sistemas",
    );
    assert.equal(codigoGuardSecapi(r.headers, r.body), "ERROR_GUARD");
    // Transitorio: no puede reportarse como "falta el secreto".
    assert.equal(esSecretoNoConfigurado(r.headers, r.body), false);
  });

  it("distingue USUARIO_NO_ENCONTRADO del resto de los 401", () => {
    const inactivo = respuestaDelGuard(
      "USUARIO_NO_ENCONTRADO",
      "Tu sesión no es válida, volvé a iniciar sesión",
    );
    const vencido = respuestaDelGuard(
      "TOKEN_VENCIDO",
      "Tu sesión no es válida, volvé a iniciar sesión",
    );
    // Mismo status y MISMO body: sin el header son indistinguibles.
    assert.equal(esUsuarioNoActivoSecapi(inactivo.headers, inactivo.body), true);
    assert.equal(esUsuarioNoActivoSecapi(vencido.headers, vencido.body), false);
  });

  it("acepta el body como fallback (caso /api/db/login, que no pasa por el guard)", () => {
    const headers = new Headers({ "content-type": "application/json" });
    const body = {
      success: false,
      error: "SECRETO_NO_CONFIGURADO",
      message: "El servidor no está configurado para emitir sesiones.",
    };
    assert.equal(esSecretoNoConfigurado(headers, body), true);
  });

  it("la prosa del guard sola no matchea ningún código", () => {
    const headers = new Headers();
    const body = { success: false, error: "Falta la credencial de acceso" };
    assert.equal(codigoGuardSecapi(headers, body), null);
  });

  it("tolera headers/body ausentes o basura", () => {
    assert.equal(codigoGuardSecapi(null), null);
    assert.equal(codigoGuardSecapi(undefined, undefined), null);
    assert.equal(codigoGuardSecapi(new Headers(), "texto plano"), null);
    assert.equal(codigoGuardSecapi(new Headers({ "x-auth-guard": "INVENTADO" }), {}), null);
  });
});
