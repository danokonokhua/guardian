# Guardian production image.
#
# The same image supports both deployment processes:
#   web:    node server.js (the standalone server entrypoint)
#   worker: npm run worker
# Keep the worker persistent; it owns pg-boss and scheduled monitor work.

FROM node:22.23.2-bookworm-slim AS build
WORKDIR /app

# The canonical URL is browser-safe and may be inlined by Next.js.
# Never pass server secrets as build arguments.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# npm ci runs the Prisma postinstall hook, so provide the schema before it
# runs rather than copying the full source tree first.
COPY db/schema.prisma ./db/schema.prisma
RUN npm ci

COPY . .
ENV NODE_ENV=production
# Next 16 defaults to Turbopack, which can exceed the memory budget on the
# small VPS targets this image is intended to support. The webpack path is
# supported by Next and keeps the image build within the documented resource
# envelope (the runtime image is unchanged).
RUN npm run build -- --webpack

FROM node:22.23.2-bookworm-slim AS runtime
WORKDIR /app

# Prisma migration and query engines require the system OpenSSL libraries in
# the runtime image as well as during the build.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user in production.
RUN groupadd --system --gid 1001 guardian \
  && useradd --system --uid 1001 --gid guardian guardian

# Next standalone output contains the traced production server and runtime deps.
COPY --from=build --chown=guardian:guardian /app/.next/standalone ./
COPY --from=build --chown=guardian:guardian /app/.next/static ./.next/static
# There is currently no public/ directory. If one is added later, copy it
# alongside .next/static so the standalone server can serve those assets.

# The persistent worker runs from TypeScript source via tsx and needs the
# generated Prisma client plus its server-side modules.
COPY --from=build --chown=guardian:guardian /app/node_modules ./node_modules
COPY --from=build --chown=guardian:guardian /app/package.json ./package.json
COPY --from=build --chown=guardian:guardian /app/package-lock.json ./package-lock.json
COPY --from=build --chown=guardian:guardian /app/scripts ./scripts
COPY --from=build --chown=guardian:guardian /app/lib ./lib
COPY --from=build --chown=guardian:guardian /app/services ./services
COPY --from=build --chown=guardian:guardian /app/config ./config
COPY --from=build --chown=guardian:guardian /app/db ./db
COPY --from=build --chown=guardian:guardian /app/types ./types
COPY --from=build --chown=guardian:guardian /app/tsconfig.json ./tsconfig.json

USER guardian
EXPOSE 3000

CMD ["node", "--require", "./scripts/server-only-cli.cjs", "./node_modules/tsx/dist/cli.mjs", "scripts/start-web.ts"]
