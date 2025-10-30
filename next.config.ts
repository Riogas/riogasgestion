import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Habilitar modo standalone para Docker
  output: 'standalone',
  
  async rewrites() {
    return [
      {
        source: "/api/:path*", // tu frontend llamará a /api/loquesea
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/puestos/gestion/:path*`
          : "http://192.168.1.72:8082/puestos/gestion/:path*", // fallback para desarrollo
      },
    ];
  },
};

// Configuración de Sentry
const sentryWebpackPluginOptions = {
  // Configuración adicional del plugin de Sentry
  silent: true, // Suprimir logs durante el build
  org: "riogas",
  project: "goya",
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
