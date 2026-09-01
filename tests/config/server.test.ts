import { describe, expect, it } from "vitest";

import type { ConfigIssue } from "@/config/env";
import { appConfig, loadServerConfig, serverConfig } from "@/config/server";

/**
 * Server aggregate configuration: environment-dependent validation, the
 * public/server boundary, and secret-safety of error messages.
 * All values here are test dummies — never real credentials.
 */

const DUMMY_DATABASE_URL = "postgresql://guardian:test-password@localhost:5432/guardian";

describe("loadServerConfig — environments", () => {
  it("builds a valid development configuration from an empty environment", () => {
    const config = loadServerConfig({});

    expect(config.nodeEnv).toBe("development");
    expect(config.isProduction).toBe(false);
    expect(config.isTest).toBe(false);
    expect(config.logLevel).toBe("info");
    expect(config.appEnv).toBe("development");
    expect(config.serviceName).toBe("guardian");
    expect(config.issues).toEqual([]);
    expect(config.public).toEqual({});
    expect(config.server).toEqual({});
  });

  it("recognizes the test environment", () => {
    const config = loadServerConfig({ NODE_ENV: "test" });
    expect(config.isTest).toBe(true);
  });
});

describe("loadServerConfig — production requirements", () => {
  it("flags a missing NEXT_PUBLIC_APP_URL in production instead of crashing", () => {
    const config = loadServerConfig({ NODE_ENV: "production" });

    const issue: ConfigIssue | undefined = config.issues.find(
      (candidate) => candidate.variable === "NEXT_PUBLIC_APP_URL",
    );

    expect(issue).toBeDefined();
    expect(issue?.scope).toBe("public");
    expect(issue?.message).toContain("required in production");
  });

  it("produces no issues in production when the app URL is configured", () => {
    const config = loadServerConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://guardian.example.com",
    });

    expect(config.issues).toEqual([]);
    expect(config.public.appUrl).toBe("https://guardian.example.com/");
  });

  it("keeps database and Supabase variables optional in EVERY environment", () => {
    for (const nodeEnv of ["development", "test", "production"] as const) {
      const config = loadServerConfig({ NODE_ENV: nodeEnv });

      expect(config.server.databaseUrl).toBeUndefined();
      expect(config.server.directUrl).toBeUndefined();
      expect(config.server.supabaseServiceRoleKey).toBeUndefined();

      const externalIssues = config.issues.filter((issue) =>
        /DATABASE|SUPABASE|DIRECT/.test(issue.variable),
      );
      expect(externalIssues).toEqual([]);
    }
  });
});

describe("loadServerConfig — reserved values", () => {
  it("accepts valid reserved values when present", () => {
    const config = loadServerConfig({
      DATABASE_URL: DUMMY_DATABASE_URL,
      DIRECT_URL: DUMMY_DATABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: "dummy-service-role-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy-anon-key",
    });

    expect(config.server.databaseUrl).toBe(DUMMY_DATABASE_URL);
    expect(config.server.directUrl).toBe(DUMMY_DATABASE_URL);
    expect(config.server.supabaseServiceRoleKey).toBe("dummy-service-role-key");
    expect(config.public.supabaseUrl).toBe("https://supabase.example.co/");
    expect(config.public.supabaseAnonKey).toBe("dummy-anon-key");
  });

  it("rejects a non-PostgreSQL DATABASE_URL without echoing its value", () => {
    const bad = "mysql://user:top-secret@localhost:3306/other-db";

    expect(() => loadServerConfig({ DATABASE_URL: bad })).toThrow(/DATABASE_URL/);

    try {
      loadServerConfig({ DATABASE_URL: bad });
      expect.unreachable("loadServerConfig should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(bad);
      expect(message).not.toContain("top-secret");
    }
  });

  it("rejects a malformed PostgreSQL URL without echoing its value", () => {
    const bad = "postgresql://user:top-secret@[::invalid";

    try {
      loadServerConfig({ DIRECT_URL: bad });
      expect.unreachable("loadServerConfig should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("DIRECT_URL");
      expect(message).not.toContain(bad);
      expect(message).not.toContain("top-secret");
    }
  });
});

describe("loadServerConfig — SENTRY_DSN (optional observability)", () => {
  it("keeps Sentry disabled when the DSN is absent", () => {
    const config = loadServerConfig({});
    expect(config.server.sentryDsn).toBeUndefined();
  });

  it("accepts a valid DSN URL", () => {
    const config = loadServerConfig({
      SENTRY_DSN: "https://abc123@example.ingest.sentry.io/42",
    });
    expect(config.server.sentryDsn).toBe("https://abc123@example.ingest.sentry.io/42");
  });

  it("rejects an invalid DSN without echoing its value", () => {
    const bad = "not-a-url-with-secret-ingredients";
    try {
      loadServerConfig({ SENTRY_DSN: bad });
      expect.unreachable("loadServerConfig should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("SENTRY_DSN");
      expect(message).not.toContain(bad);
    }
  });

  it("treats a blank DSN as unset", () => {
    expect(loadServerConfig({ SENTRY_DSN: "   " }).server.sentryDsn).toBeUndefined();
  });
});

describe("server configuration singleton", () => {
  it("exposes the process configuration and the backward-compatible alias", () => {
    expect(serverConfig.serviceName).toBe("guardian");
    expect(appConfig).toBe(serverConfig);
  });

  it("separates public and server scopes structurally", () => {
    expect(Object.keys(serverConfig.public)).not.toContain("databaseUrl");
    expect(Object.keys(serverConfig.public)).not.toContain("supabaseServiceRoleKey");
    expect(Object.keys(serverConfig.server)).not.toContain("appUrl");
    expect(Object.keys(serverConfig.server)).not.toContain("supabaseAnonKey");
  });
});

describe("loadServerConfig — CRON_SECRET (scheduler authentication)", () => {
  it("accepts a configured cron secret without exposing it in config errors", () => {
    const config = loadServerConfig({ CRON_SECRET: "cron-secret-test" });
    expect(config.server.cronSecret).toBe("cron-secret-test");
  });

  it("treats a blank cron secret as unset", () => {
    expect(loadServerConfig({ CRON_SECRET: "   " }).server.cronSecret).toBeUndefined();
  });
});
