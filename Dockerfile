# syntax=docker/dockerfile:1
# --------------------------------------------------------------------------- #
# Aviso TM API (NestJS + Prisma + Puppeteer) — production image for Railway.   #
# Monorepo: this Dockerfile builds ONLY the `api` package. The Angular `web`   #
# app is deployed separately (Vercel) — see vercel.json + README "Deploy".     #
# --------------------------------------------------------------------------- #

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Puppeteer uses the system Chromium (installed in the runtime stage), so never
# download its own bundled browser during install.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable
WORKDIR /app

# ---- Build stage: install (incl. dev) + generate Prisma client + compile ---- #
FROM base AS build
# openssl so `prisma generate` picks the openssl-3.0 engine (matches runtime).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
# Only the manifests first, for a cached dependency layer. Every workspace
# package.json must be present for pnpm to resolve the workspace.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY api/package.json ./api/
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile --filter api...

# Now the api source (web/ is not needed for this image).
COPY api ./api
RUN pnpm --filter api exec prisma generate \
  && pnpm --filter api build

# ---- Runtime stage: system Chromium + the built app --------------------------- #
FROM base AS runtime
ENV NODE_ENV=production
# Chromium + the libraries Puppeteer needs, and openssl for Prisma's engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     chromium \
     fonts-liberation \
     ca-certificates \
     openssl \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# The pnpm node_modules layout is relative-symlinked, so copying the whole /app
# tree between identical base images keeps every link (and the generated Prisma
# client + CLI) valid.
COPY --from=build /app /app

# Apply pending migrations, then start the compiled server. PORT is injected by
# the platform (main.ts falls back to 3000); health check lives at /health.
CMD ["sh", "-c", "pnpm --filter api exec prisma migrate deploy && node api/dist/main.js"]
