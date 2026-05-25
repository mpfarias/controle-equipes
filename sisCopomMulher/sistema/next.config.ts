import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** Evita aviso de lockfile duplo quando existe `package-lock.json` na raiz do monorepo. */
  turbopack: {
    root: __dirname,
  },
  reactStrictMode: true,
  experimental: {
    /** Menos JS no cliente para o painel com Recharts. */
    optimizePackageImports: ["recharts"],
    /** Upload de Excel na API `/api/import/excel` (multipart). */
    serverActions: { bodySizeLimit: "32mb" },
  },
  /** Origens permitidas no dev (incluir porta evita bloqueio de `/_next/*` em 127.0.0.1:3001). */
  allowedDevOrigins: ["127.0.0.1:3001", "localhost:3001", "127.0.0.1", "localhost"],
  /** Reduz injeção de devtools que em alguns setups dispara 500 / SegmentViewNode no /login. */
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/login",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      {
        source: "/app/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" }],
      },
      {
        source: "/mobile-vitima",
        headers: [{ key: "Permissions-Policy", value: "geolocation=(self)" }],
      },
      {
        source: "/simulador-celular",
        headers: [{ key: "Permissions-Policy", value: "geolocation=(self)" }],
      },
    ];
  },
};

export default nextConfig;
