import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  // The Automation Hub spawns Playwright as a child process and resolves its CLI at
  // runtime — keep these out of the server bundle so require.resolve hits node_modules.
  serverExternalPackages: ['@playwright/test', 'playwright', 'playwright-core', '@modelcontextprotocol/sdk', '@playwright/mcp'],
  // @node-rs/bcrypt loads platform-specific .node binaries at runtime via a path
  // that static tracing doesn't always follow — include them explicitly.
  outputFileTracingIncludes: {
    '/**': ['./node_modules/@node-rs/**/*.node'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Bug attachments allow up to 25MB per file. The app uses proxy.ts, so the
    // proxy buffers the request body (default cap 10MB). Raise it to 30MB to give
    // headroom above the 25MB attachment cap so the route's own size check can
    // return a clean 413 instead of the body being silently truncated.
    proxyClientMaxBodySize: "30mb",
  },
  env: {
    DATA_ROOT: process.env.DATA_ROOT ?? path.join(process.cwd(), "data"),
  },
  // Security headers applied to all routes. Content-Security-Policy is
  // deliberately deferred — this app relies on inline styles/scripts in
  // several places and a CSP would need careful auditing to avoid breakage.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
