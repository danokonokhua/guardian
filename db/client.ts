import "server-only";

/**
 * Server-only Prisma client.
 *
 * The `server-only` marker makes any client/browser import of this module a
 * hard build error — DATABASE_URL can never reach a browser bundle.
 *
 * Connection behavior:
 * - Credentials are resolved by Prisma from DATABASE_URL (see db/schema.prisma;
 *   the env() reference is the sanctioned mechanism for the ORM/CLI, mirroring
 *   the next.config.ts NODE_ENV exception — the application-facing accessor
 *   remains `config/server.ts`, which this module also uses for behavior).
 * - Instantiation is LAZY: importing this module never opens (or requires) a
 *   connection, so the app runs in development without a database configured.
 * - Hot-reload safety: in non-production environments the client is cached on
 *   `globalThis` so Next.js dev re-evaluations reuse one instance instead of
 *   leaking a pool per reload.
 */

import { PrismaClient } from "@prisma/client";

import { serverConfig } from "@/config/server";

type PrismaGlobal = typeof globalThis & {
  __guardianPrisma?: PrismaClient;
};

const globalForPrisma = globalThis as PrismaGlobal;

let cachedClient: PrismaClient | undefined;

/** Lazily creates (or returns) the process-wide Prisma client. */
export function getPrisma(): PrismaClient {
  if (cachedClient !== undefined) {
    return cachedClient;
  }
  if (!serverConfig.isProduction && globalForPrisma.__guardianPrisma !== undefined) {
    cachedClient = globalForPrisma.__guardianPrisma;
    return cachedClient;
  }
  const client = new PrismaClient();
  cachedClient = client;
  if (!serverConfig.isProduction) {
    globalForPrisma.__guardianPrisma = client;
  }
  return client;
}
