// GET /api/docs/spec — catálogo de APIs de GOYA (solo root).
//
// Devuelve docs/api/openapi.json mergeado con docs/api/anotaciones.yaml. El
// documento se sirve desde el JSON versionado y no del Swagger vivo del
// backend, que está apagado cuando NODE_ENV=production.
//
// El gate es requireRoot: verifica contra secapi en cada request y es
// fail-closed (si secapi no responde, 503, no se abre). Ver src/lib/docs/root-guard.ts.
import { NextRequest, NextResponse } from "next/server";
import { requireRoot } from "@/lib/docs/root-guard";
import { cargarCatalogo } from "@/lib/docs/spec";

// Lee archivos del disco → Node runtime, y nunca cacheado.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireRoot(req);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.code },
      { status: guard.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { documento } = cargarCatalogo();
    return NextResponse.json(documento, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api/docs/spec]", err);
    return NextResponse.json(
      { error: "SPEC_NO_DISPONIBLE", detail: (err as Error)?.message },
      { status: 500 },
    );
  }
}
