import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Database client foundation tests (no live database required):
 * - server-only boundary is enforced in source
 * - lazy singleton behavior + Next.js hot-reload safety via globalThis caching
 * - construction never requires a configured database
 *
 * Each behavioral test imports a FRESH module instance (vi.resetModules) so
 * module-level caching state never leaks between tests — this mirrors what
 * Next.js dev hot-reload actually does (re-evaluation with a shared global).
 *
 * No real credentials are used anywhere in this file.
 */

type PrismaGlobal = typeof globalThis & { __guardianPrisma?: unknown };

async function freshClientModule(): Promise<typeof import("@/db/client")> {
  vi.resetModules();
  return import("@/db/client");
}

describe("db/client server-only boundary", () => {
  it("is gated by the `server-only` marker", () => {
    const source = readFileSync("db/client.ts", "utf8");
    expect(source).toContain('import "server-only";');
  });
});

describe("getPrisma", () => {
  beforeEach(() => {
    delete (globalThis as PrismaGlobal).__guardianPrisma;
    vi.resetModules();
  });

  it("returns the same instance on every call (process singleton)", async () => {
    const { getPrisma } = await freshClientModule();
    expect(getPrisma()).toBe(getPrisma());
  });

  it("caches the client on globalThis outside production (hot-reload safety)", async () => {
    const { getPrisma } = await freshClientModule();
    const client = getPrisma();
    expect((globalThis as PrismaGlobal).__guardianPrisma).toBe(client);
  });

  it("reuses the global cache across simulated module re-evaluations", async () => {
    const before = (await freshClientModule()).getPrisma();
    // Fresh module evaluation (hot reload) must pick up the cached instance.
    const after = (await freshClientModule()).getPrisma();
    expect(after).toBe(before);
  });

  it("does not open or require a database connection at construction", async () => {
    // DATABASE_URL is intentionally unset in the test environment; creating
    // the client must still succeed (connections are lazy in Prisma).
    const { getPrisma } = await freshClientModule();
    expect(() => getPrisma()).not.toThrow();
  });

  it("does not pollute globalThis in production mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { getPrisma } = await freshClientModule();
      getPrisma();
      expect((globalThis as PrismaGlobal).__guardianPrisma).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
