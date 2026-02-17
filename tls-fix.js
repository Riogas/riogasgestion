// Forzar que Node.js ignore certificados auto-firmados
// Se carga antes del server con: node -r ./tls-fix.js server.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
