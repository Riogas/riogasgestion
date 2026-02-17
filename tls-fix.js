// Forzar que Node.js ignore certificados auto-firmados
// Se carga antes del server con: node -r ./tls-fix.js

// 1. Para el módulo tls nativo de Node.js (axios, https.request, etc.)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 2. Para undici (usado internamente por Next.js 16 en rewrites/proxy)
try {
  const { Agent, setGlobalDispatcher } = require('undici');
  setGlobalDispatcher(new Agent({
    connect: {
      rejectUnauthorized: false,
    },
  }));
} catch (e) {
  // Si undici no está disponible, solo usar NODE_TLS_REJECT_UNAUTHORIZED
  console.warn('[tls-fix] No se pudo configurar undici:', e.message);
}
