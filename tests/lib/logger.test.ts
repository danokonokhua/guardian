import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "@/lib/logger";

interface Captured {
  log: string[];
  warn: string[];
  error: string[];
}

let captured: Captured;

function parse(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

describe("logger", () => {
  beforeEach(() => {
    captured = { log: [], warn: [], error: [] };
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      captured.log.push(String(args[0]));
    });
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      captured.warn.push(String(args[0]));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      captured.error.push(String(args[0]));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits structured JSON with level, service, and message", () => {
    const logger = createLogger({}, { level: "debug" });
    logger.info("service started");

    expect(captured.log).toHaveLength(1);
    const entry = parse(captured.log[0] ?? "");
    expect(entry["message"]).toBe("service started");
    expect(entry["level"]).toBe("info");
    expect(entry["service"]).toBe("guardian");
    expect(typeof entry["time"]).toBe("string");
  });

  it("routes warn/error levels to the matching console sink", () => {
    const logger = createLogger({}, { level: "debug" });
    logger.warn("careful");
    logger.error("broken");

    expect(captured.warn).toHaveLength(1);
    expect(captured.error).toHaveLength(1);
    expect(parse(captured.warn[0] ?? "")["message"]).toBe("careful");
    expect(parse(captured.error[0] ?? "")["message"]).toBe("broken");
  });

  it("suppresses messages below the configured minimum level", () => {
    const logger = createLogger({}, { level: "info" });
    logger.debug("hidden");

    expect(captured.log).toHaveLength(0);
  });

  it("merges base, child, and per-call context", () => {
    const logger = createLogger({ component: "api" }, { level: "info" }).child({
      route: "/api/health",
    });
    logger.info("handled", { durationMs: 3 });

    const entry = parse(captured.log[0] ?? "");
    expect(entry["component"]).toBe("api");
    expect(entry["route"]).toBe("/api/health");
    expect(entry["durationMs"]).toBe(3);
  });

  it("redacts sensitive keys at the top level and nested", () => {
    const logger = createLogger({}, { level: "info" });
    logger.info("user authenticated", {
      email: "owner@example.com",
      password: "hunter2",
      nested: { apiToken: "sk-live-123", safe: "value" },
    });

    const entry = parse(captured.log[0] ?? "");
    const context = entry["nested"] as Record<string, unknown>;
    expect(entry["email"]).toBe("owner@example.com");
    expect(entry["password"]).toBe("[REDACTED]");
    expect(context["apiToken"]).toBe("[REDACTED]");
    expect(context["safe"]).toBe("value");
    expect(captured.log[0]).not.toContain("hunter2");
    expect(captured.log[0]).not.toContain("sk-live-123");
  });

  it("redacts the full sensitive-key family (Phase 1B-08 contract)", () => {
    const logger = createLogger({}, { level: "info" });
    logger.info("auth flow", {
      accessToken: "at-secret",
      refreshToken: "rt-secret",
      apiKey: "ak-secret",
      authorization: "Bearer eyJ-secret",
      cookie: "session=abc123",
      session: "sess-secret",
      secret: "raw-secret",
    });

    const raw = captured.log[0] ?? "";
    for (const leaked of [
      "at-secret",
      "rt-secret",
      "ak-secret",
      "eyJ-secret",
      "abc123",
      "sess-secret",
      "raw-secret",
    ]) {
      expect(raw).not.toContain(leaked);
    }
    const entry = parse(raw);
    for (const key of [
      "accessToken",
      "refreshToken",
      "apiKey",
      "authorization",
      "cookie",
      "session",
      "secret",
    ]) {
      expect(entry[key]).toBe("[REDACTED]");
    }
  });

  it("exports redactForLogging with the same policy for the observability layer", async () => {
    const { redactForLogging } = await import("@/lib/logger");
    const redacted = redactForLogging({
      password: "hunter2",
      nested: { apiKey: "ak-secret", safe: 1 },
    }) as Record<string, unknown>;
    expect(redacted["password"]).toBe("[REDACTED]");
    expect((redacted["nested"] as Record<string, unknown>)["apiKey"]).toBe("[REDACTED]");
    expect((redacted["nested"] as Record<string, unknown>)["safe"]).toBe(1);
  });

  it("serializes Error objects instead of collapsing them to {}", () => {
    const logger = createLogger({}, { level: "info" });
    logger.error("request failed", { error: new Error("boom") });

    const entry = parse(captured.error[0] ?? "");
    const serialized = entry["error"] as Record<string, unknown>;
    expect(serialized["name"]).toBe("Error");
    expect(serialized["message"]).toBe("boom");
    expect(typeof serialized["stack"]).toBe("string");
  });
});
