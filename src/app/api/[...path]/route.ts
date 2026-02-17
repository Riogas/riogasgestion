import { NextRequest, NextResponse } from "next/server";
import https from "https";
import http from "http";

// Forzar Node.js runtime (no Edge) para usar https.Agent nativo
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Agente HTTPS que acepta certificados autofirmados
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://sgm.glp.riogas.com.uy";

const BACKEND_PREFIX = "/gestion";

async function proxyRequest(req: NextRequest) {
  // Extraer el path después de /api/
  const url = new URL(req.url);
  const pathAfterApi = url.pathname.replace(/^\/api/, "");
  const targetUrl = `${API_BASE}${BACKEND_PREFIX}${pathAfterApi}${url.search}`;

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
        
        console.log(`[API Proxy] Response: ${proxyRes.statusCode} | Content-Type: ${proxyRes.headers['content-type']} | Body length: ${responseBody.length}`);
        console.log(`[API Proxy] Body preview: ${responseBody.toString('utf-8').substring(0, 500)}`);
        
        // Copiar headers de respuesta del backend
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (value && !["transfer-encoding", "connection"].includes(key.toLowerCase())) {
            const val = Array.isArray(value) ? value.join(", ") : value;
            responseHeaders.set(key, val);
          }
        }

        resolve(
          new NextResponse(responseBody, {
            status: proxyRes.statusCode || 500,
            headers: responseHeaders,
          })
        );
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
