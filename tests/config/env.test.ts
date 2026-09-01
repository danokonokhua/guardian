import { describe, expect, it } from "vitest";

import { EnvironmentConfigError, loadConfig } from "@/config/env";

describe("loadConfig", () => {
  it("applies safe defaults for an empty environment", () => {
    const config = loadConfig({});

    expect(config.nodeEnv).toBe("development");
    expect(config.logLevel).toBe("info");
    expect(config.serviceName).toBe("guardian");
    expect(config.isProduction).toBe(false);
    expect(config.isTest).toBe(false);
    expect(config.appEnv).toBe("development");
  });

  it("accepts valid explicit values", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      LOG_LEVEL: "warn",
      APP_ENV: "staging",
    });

    expect(config.nodeEnv).toBe("production");
    expect(config.isProduction).toBe(true);
    expect(config.logLevel).toBe("warn");
    expect(config.appEnv).toBe("staging");
  });

  it("fails fast on an invalid LOG_LEVEL", () => {
    expect(() => loadConfig({ LOG_LEVEL: "verbose" })).toThrow(EnvironmentConfigError);
  });

  it("fails fast on an invalid NODE_ENV", () => {
    expect(() => loadConfig({ NODE_ENV: "staging" })).toThrow(EnvironmentConfigError);
  });

  it("produces an actionable error message for invalid values", () => {
    try {
      loadConfig({ LOG_LEVEL: "verbose" });
      expect.unreachable("loadConfig should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentConfigError);
      expect((error as EnvironmentConfigError).message).toContain("debug, info, warn, error");
    }
  });
});
