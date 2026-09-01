import { describe, expect, it, vi } from "vitest";

/**
 * Database health probe tests. No production database is used.
 * The unreachable target is a local port with nothing listening — connection
 * is refused immediately; it contains no real credentials.
 */

const UNREACHABLE_URL = "postgresql://guardian:test-only@127.0.0.1:5987/guardian_test";

async function importHealthWithEnv(databaseUrl: string | undefined) {
  vi.resetModules();
  if (databaseUrl === undefined) {
    vi.stubEnv("DATABASE_URL", "");
  } else {
    vi.stubEnv("DATABASE_URL", databaseUrl);
  }
  return import("@/db/health");
}

describe("getDatabaseHealth", () => {
  it("reports `unconfigured` without touching Prisma when DATABASE_URL is absent", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { getDatabaseHealth } = await importHealthWithEnv(undefined);
      const result = await getDatabaseHealth();
      expect(result.status).toBe("unconfigured");
      expect("latencyMs" in result).toBe(false);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("reports `unhealthy` — sanitized — when the database is unreachable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { getDatabaseHealth } = await importHealthWithEnv(UNREACHABLE_URL);
      const result = await getDatabaseHealth();

      expect(result.status).toBe("unhealthy");
      // The public result must never carry connection details.
      expect(JSON.stringify(result)).not.toContain("postgresql://");
      expect(JSON.stringify(result)).not.toContain(UNREACHABLE_URL);
      expect(JSON.stringify(result)).not.toContain("guardian_test");
      // Diagnostics went to the server-side logger instead.
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  }, 15000);

  it("never discloses credentials in logged diagnostics", async () => {
    const captured: string[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      captured.push(String(args[0]));
    });
    try {
      const { getDatabaseHealth } = await importHealthWithEnv(UNREACHABLE_URL);
      await getDatabaseHealth();
      const logged = captured.join(" ");
      // The Prisma error may name the host, but the credentials embedded in
      // the connection string must never appear.
      expect(logged).not.toContain("test-only");
      expect(logged).not.toContain("postgresql://guardian");
    } finally {
      consoleError.mockRestore();
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  }, 15000);
});
