// El catch-all /api/[...path] republica cualquier path hacia el backend. Este
// test fija que los paths del Swagger vivo NO salgan por ahí, y que el bloqueo
// no se coma nada legítimo.
//   pnpm test:docs
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esPathDeDocumentacion } from "./paths-bloqueados";

describe("esPathDeDocumentacion", () => {
  it("bloquea los tres paths del Swagger de NestJS", () => {
    assert.equal(esPathDeDocumentacion("/api/docs"), true);
    assert.equal(esPathDeDocumentacion("/api/docs-json"), true);
    assert.equal(esPathDeDocumentacion("/api/docs-yaml"), true);
  });

  it("bloquea con barra final, con subpath y sin importar el case", () => {
    assert.equal(esPathDeDocumentacion("/api/docs/"), true);
    assert.equal(esPathDeDocumentacion("/api/docs/swagger-ui-init.js"), true);
    assert.equal(esPathDeDocumentacion("/api/DOCS-JSON"), true);
  });

  it("no bloquea prefijos parecidos ni el resto de la API", () => {
    assert.equal(esPathDeDocumentacion("/api/docsfalsos"), false);
    assert.equal(esPathDeDocumentacion("/api/documentos"), false);
    assert.equal(esPathDeDocumentacion("/api/clientes"), false);
    assert.equal(esPathDeDocumentacion("/api/zonas/sync/webhook"), false);
    assert.equal(esPathDeDocumentacion("/api"), false);
  });

  it("el route handler propio /api/docs/spec no llega nunca al catch-all", () => {
    // Next resuelve primero los archivos concretos (src/app/api/docs/spec/route.ts)
    // y sólo cae al [...path] si ninguno matchea. Si algún día llegara acá,
    // que quede claro que este helper SÍ lo bloquearía: el portal no depende
    // del proxy, lee el JSON del disco.
    assert.equal(esPathDeDocumentacion("/api/docs/spec"), true);
  });
});
