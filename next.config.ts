import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Desactivar TypeScript checks en build de producción
  typescript: {
    ignoreBuildErrors: true,
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
