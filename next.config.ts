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
    // In dev, Next probes static paths for every app-router dynamic route
    // (base-server.js: `isDynamicRoute(pathname) && (getStaticPaths || isAppPath)`),
    // and every probe forks a throwaway jest-worker child that loads the whole
    // route module graph — typeorm/mssql plus the native @node-rs/bcrypt addon.
    // On Windows those forks intermittently die at startup, and with the worker's
    // maxRetries of 1 the request fails with "Jest worker encountered 2 child
    // process exceptions, exceeding retry limit" — surfaced as a runtime error in
    // the browser. No route in src/ exports generateStaticParams, so the probe
    // finds nothing either way. This makes the probe a worker thread instead of a
    // forked process: same result, no per-request process spawn. Dev only —
    // `next build` reuses this flag for its static-generation workers, and those
    // are what the Dockerfile's 2GB --max-old-space-size is sized for (threads
    // would share one heap instead of getting their own).
    workerThreads: process.env.NODE_ENV !== "production",
  },
  env: {
    DATA_ROOT: process.env.DATA_ROOT ?? path.join(process.cwd(), "data"),
  },
  // Security headers applied to all routes. A directive-limited
  // Content-Security-Policy is applied below; full script-src (nonce
  // plumbing) is still deferred — this app relies on inline scripts in
  // several places and that would need careful auditing to avoid breakage.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Legacy-agent fallback; frame-ancestors below supersedes this in
          // modern browsers but older ones only honor X-Frame-Options.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
