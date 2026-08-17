import { NextRequest, NextResponse } from "next/server";
import https from "https";
import http from "http";
import { esPathDeDocumentacion } from "@/lib/docs/paths-bloqueados";

// Forzar Node.js runtime (no Edge) para usar https.Agent nativo
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Permitir bodies grandes (GeoJSON de zonas puede superar 1MB)
export const maxDuration = 60;
export const fetchCache = "default-no-store";

// Agente HTTPS que acepta certificados autofirmados
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

// ============================================
// BACKEND MODE: 'legacy' (GeneXus) o 'nestjs'
// ============================================
const BACKEND_MODE = process.env.NEXT_PUBLIC_API_BACKEND || "legacy";

// Legacy (GeneXus/sgm.riogas)
const LEGACY_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://sgm.glp.riogas.com.uy";
const LEGACY_PREFIX = "/gestion";

// NestJS (nuevo backend)
const NESTJS_API_BASE =
  process.env.NEXT_PUBLIC_NESTJS_API_URL ||
  "http://localhost:3001";
const NESTJS_PREFIX = "/api"; // NestJS global prefix

/** Content-types cuyo body tiene sentido loguear como texto. */
function esTexto(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return (
    ct.startsWith("text/") ||
    ct.includes("json") ||
    ct.includes("xml") ||
    ct.includes("javascript") ||
    ct.includes("x-www-form-urlencoded")
  );
}

async function proxyRequest(req: NextRequest) {
  // Extraer el path después de /api/
  const url = new URL(req.url);
  const pathAfterApi = url.pathname.replace(/^\/api/, "");

  // /api/docs, /api/docs-json y /api/docs-yaml NO se republican nunca: el
  // Swagger vivo de Nest queda fuera del pipeline de guards y serviría el
  // catálogo entero sin autenticación. Ver src/lib/docs/paths-bloqueados.ts.
  // Se responde 404 (no 403) a propósito: no confirma que exista nada del otro lado.
  if (esPathDeDocumentacion(url.pathname)) {
    console.warn(`[API Proxy] BLOQUEADO ${req.method} ${url.pathname} (documentación: no se proxea)`);
    return NextResponse.json(
      { error: "NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Determinar destino según el modo de backend
  const isNestjs = BACKEND_MODE === "nestjs";
  const apiBase = isNestjs ? NESTJS_API_BASE : LEGACY_API_BASE;
  const prefix = isNestjs ? NESTJS_PREFIX : LEGACY_PREFIX;
  const targetUrl = `${apiBase}${prefix}${pathAfterApi}${url.search}`;

  console.log(`[API Proxy] ${req.method} ${url.pathname} -> ${targetUrl}`);

  // Copiar headers relevantes del request original
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    // No enviar headers de host/connection del cliente
    if (!["host", "connection", "transfer-encoding"].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  });

  // Leer body si existe (POST, PUT, PATCH, DELETE)
  let body: Buffer | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      const arrayBuffer = await req.arrayBuffer();
      body = Buffer.from(arrayBuffer);
    } catch {
      // Sin body
    }
  }

  // Hacer el request al backend usando http/https nativo con el agente inseguro
  return new Promise<NextResponse>((resolve) => {
    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === "https:";
    const transport = isHttps ? https : http;

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers,
      ...(isHttps ? { agent: insecureAgent } : {}),
    };

    const proxyReq = transport.request(options, (proxyRes) => {
      const chunks: Buffer[] = [];
      proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const responseBody = Buffer.concat(chunks);
        
        const contentType = String(proxyRes.headers["content-type"] ?? "");

        console.log(`[API Proxy] Response: ${proxyRes.statusCode} | Content-Type: ${contentType} | Body length: ${responseBody.length}`);
        // El preview se decodifica SOLO del primer tramo y SOLO si el body es
        // texto: hacer toString() de un binario grande duplica el uso de RAM.
        if (esTexto(contentType)) {
          console.log(`[API Proxy] Body preview: ${responseBody.subarray(0, 500).toString("utf-8")}`);
        }

        // Copiar headers de respuesta del backend
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (value && !["transfer-encoding", "connection"].includes(key.toLowerCase())) {
            const val = Array.isArray(value) ? value.join(", ") : value;
            responseHeaders.set(key, val);
          }
        }

        const status = proxyRes.statusCode || 500;

        // 204/205/304 son "null body status": el constructor de Response tira
        // TypeError si se le pasa un body (aunque sea un Buffer vacío). Como el
        // throw ocurre adentro del executor de la Promise, nadie la resuelve y
        // el request queda colgado hasta el timeout del cliente (además de un
        // uncaughtException en el server). Pasa con cualquier GET revalidado:
        // el browser manda If-None-Match y el backend responde 304.
        const sinBody = status === 204 || status === 205 || status === 304;

        try {
          resolve(
            new NextResponse(sinBody ? null : responseBody, {
              status,
              headers: responseHeaders,
            })
          );
        } catch (err) {
          // Cinturón y tiradores: cualquier otro error armando la respuesta
          // devuelve 502 en vez de dejar la promesa sin resolver.
          console.error(`[API Proxy] Error armando la respuesta (${status}):`, err);
          resolve(
            NextResponse.json(
              { error: "Error building proxy response", details: String(err) },
              { status: 502 }
            )
          );
        }
      });
    });

    proxyReq.on("error", (err) => {
      console.error(`[API Proxy] Error proxying ${req.method} ${targetUrl}:`, err.message);
      resolve(
        NextResponse.json(
          { error: "Error connecting to backend", details: err.message },
          { status: 502 }
        )
      );
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
}

export async function GET(req: NextRequest) {
  return proxyRequest(req);
}

export async function POST(req: NextRequest) {
  return proxyRequest(req);
}

export async function PUT(req: NextRequest) {
  return proxyRequest(req);
}

export async function PATCH(req: NextRequest) {
  return proxyRequest(req);
}

export async function DELETE(req: NextRequest) {
  return proxyRequest(req);
}
