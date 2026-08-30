# ─── Stage 1: Install production dependencies ────────────────────────────────
# Debian (glibc), NOT alpine: Playwright's browser builds and the native modules
# (@node-rs/bcrypt, mssql) don't run on musl.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ─── Stage 2: Build the Next.js app ──────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build
# Compile database TypeScript so the migration runner can execute without ts-node
RUN npx tsc -p database/tsconfig.json

# ─── Stage 3: Production runtime ─────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Shared browser cache readable by the nextjs user (default would be /root/.cache).
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 --ingroup nodejs nextjs

# Standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Standalone trace excludes native/optional packages (typeorm, mssql, reflect-metadata).
# Copy full production node_modules so startup.js can find all its deps.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

COPY --from=builder --chown=nextjs:nodejs /app/database/dist ./database/dist
COPY --from=builder --chown=nextjs:nodejs /app/start.sh ./start.sh

# Automation Hub replay spawns node_modules/@playwright/test/cli.js at runtime —
# install chromium (+ headless shell) and its OS deps as root, world-readable.
# Version-locked to the installed @playwright/test (never bare `npx playwright`).
RUN node node_modules/@playwright/test/cli.js install --with-deps chromium && \
    chmod -R a+rX /ms-playwright

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "start.sh"]
