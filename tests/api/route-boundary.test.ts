import { describe, expect, it, vi } from "vitest";

import { withRoute } from "@/lib/api";
import { NotFoundError, ValidationError, type ApiErrorBody } from "@/lib/errors";

/**
 * Exercises the API error boundary directly (without a running server):
 * known AppErrors surface their code/status; unexpected errors collapse
 * into a sanitized 500 that leaks nothing.
 */

function silenceLogger() {
  // The boundary logs unknown errors server-side; keep test output clean.
  return [vi.spyOn(console, "error").mockImplementation(() => {})];
}

describe("withRoute error boundary", () => {
  it("passes successful handler responses through untouched", async () => {
    const handler = withRoute(async () => new Response("ok", { status: 200 }));

    const response = await handler(new Request("http://localhost:3000/api/ping"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });

  it("maps ValidationError to a 400 with the canonical error body", async () => {
    const spies = silenceLogger();
    const handler = withRoute(async () => {
      throw new ValidationError("url must be a valid http(s) URL", { field: "url" });
    });

    const response = await handler(new Request("http://localhost:3000/api/websites"));
    const body = (await response.json()) as ApiErrorBody;

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("url");
    expect(body.error.requestId).toBeDefined();
    expect(response.headers.get("x-request-id")).toBe(body.error.requestId);

    spies.forEach((spy) => spy.mockRestore());
  });

  it("logs unexpected errors as structured JSON with message + requestId", async () => {
    const captured: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      captured.push(String(args[0]));
    });
    const handler = withRoute(async () => {
      throw new Error("disk on fire at /var/data");
    });

    const response = await handler(new Request("http://localhost:3000/api/anything"));
    const body = (await response.json()) as ApiErrorBody;

    expect(captured.length).toBe(1);
    const entry = JSON.parse(captured[0] ?? "") as Record<string, unknown>;
    expect(entry["message"]).toBe("api_route_unhandled_error");
    expect(entry["level"]).toBe("error");
    expect(entry["requestId"]).toBe(body.error.requestId);
    // Full diagnostic detail lives ONLY in the server-side structured log;
    // the client envelope stays sanitized (generic code + message, no internals).
    expect(captured[0]).toContain("disk on fire");
    expect(JSON.stringify(body)).not.toContain("disk on fire");
    expect(body.error.code).toBe("INTERNAL_ERROR");
    spy.mockRestore();
  });

  it("sanitizes unexpected errors to a generic 500", async () => {
    const spies = silenceLogger();
    const handler = withRoute(async () => {
      throw new Error("ECONNREFUSED database password=hunter2 at /var/lib/pg");
    });

    const response = await handler(new Request("http://localhost:3000/api/anything"));
    const body = (await response.json()) as ApiErrorBody;
    const raw = JSON.stringify(body);

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("An unexpected error occurred.");
    expect(raw).not.toContain("hunter2");
    expect(raw).not.toContain("ECONNREFUSED");
    expect(raw).not.toContain("stack");

    spies.forEach((spy) => spy.mockRestore());
  });

  it("still returns a structured body for NotFoundError from route handlers", async () => {
    const handler = withRoute(async () => {
      throw new NotFoundError("Organization");
    });

    const response = await handler(new Request("http://localhost:3000/api/organizations/1"));
    const body = (await response.json()) as ApiErrorBody;

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
