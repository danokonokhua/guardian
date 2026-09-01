import { describe, expect, it } from "vitest";

import { loadPublicConfig } from "@/config/public";

/**
 * The public configuration subset must be complete for browser-safe values
 * and structurally incapable of carrying server-only values.
 * All values here are test dummies — never real credentials.
 */

const DUMMY_SERVER_ENV = {
  DATABASE_URL: "postgresql://guardian:db-password@localhost:5432/guardian",
  DIRECT_URL: "postgresql://guardian:db-password@localhost:5432/guardian",
  SUPABASE_SERVICE_ROLE_KEY: "dummy-service-role-key",
};

describe("loadPublicConfig", () => {
  it("returns parsed public configuration when variables are set", () => {
    const config = loadPublicConfig({
      NEXT_PUBLIC_APP_URL: "https://guardian.example.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy-anon-key",
    });

    expect(config.appUrl).toBe("https://guardian.example.com/");
    expect(config.supabaseUrl).toBe("https://supabase.example.co/");
    expect(config.supabaseAnonKey).toBe("dummy-anon-key");
  });

  it("omits optional public variables entirely when absent", () => {
    const config = loadPublicConfig({});

    expect(config).toEqual({});
    expect("appUrl" in config).toBe(false);
    expect(Object.isFrozen(config)).toBe(false); // shape contract only
  });

  it("never exposes server-only variables through the public configuration", () => {
    const config = loadPublicConfig({
      ...DUMMY_SERVER_ENV,
      NEXT_PUBLIC_APP_URL: "https://guardian.example.com",
    });

    expect(Object.keys(config)).toEqual(["appUrl"]);

    const serialized = JSON.stringify(config);
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("DIRECT_URL");
    expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serialized).not.toContain("db-password");
    expect(serialized).not.toContain("dummy-service-role-key");
  });

  it("rejects an invalid NEXT_PUBLIC_APP_URL without echoing its value", () => {
    const bad = "javascript:alert(1)-definitely-not-a-url";

    expect(() => loadPublicConfig({ NEXT_PUBLIC_APP_URL: bad })).toThrow(/NEXT_PUBLIC_APP_URL/);

    try {
      loadPublicConfig({ NEXT_PUBLIC_APP_URL: bad });
      expect.unreachable("loadPublicConfig should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toContain(bad);
    }
  });

  it("rejects a non-http(s) Supabase URL", () => {
    expect(() =>
      loadPublicConfig({ NEXT_PUBLIC_SUPABASE_URL: "ftp://supabase.example.com" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("treats blank values as unset", () => {
    expect(loadPublicConfig({ NEXT_PUBLIC_APP_URL: "   " })).toEqual({});
  });
});
