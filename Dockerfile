# syntax=docker/dockerfile:1

# ---------- deps: full install for the build ----------
FROM node:25-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- build: compile the app and bundle the migrator ----------
FROM node:25-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Nitro server bundle -> .output ; standalone migrator -> .output/migrate.mjs.
# A valid-shaped key is provided only for this build step (build-time module
# evaluation); it is not a secret and never reaches the runtime image.
RUN APP_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= pnpm build \
 && pnpm exec esbuild scripts/migrate.mjs \
      --bundle --platform=node --format=esm \
      --external:pg-native \
      --banner:js="import{createRequire as _cr}from'module';const require=_cr(import.meta.url);" \
      --outfile=.output/migrate.mjs

# ---------- runner: minimal, non-root ----------
FROM node:25-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    MIGRATIONS_FOLDER=/app/drizzle

# Run as an unprivileged user.
RUN addgroup -S app && adduser -S app -G app

# The Nitro output is self-contained; the migrator bundle carries its own deps.
COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle
COPY --chmod=0755 docker/entrypoint.sh ./entrypoint.sh

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
