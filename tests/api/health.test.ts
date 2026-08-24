import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";
import type { HealthResponse } from "@/types/api";

describe("GET /api/health", () => {
  it("returns 200 with the expected liveness payload", async () => {
    const response = await GET(new Request("http://localhost:3000/api/health"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as HealthResponse;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("guardian");
    expect(typeof body.version).toBe("string");
    expect(typeof body.environment).toBe("string");
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.requestId).toBe("string");
  });

  it("returns a fresh timestamp per request", async () => {
    const first = (await (
      await GET(new Request("http://localhost:3000/api/health"))
    ).json()) as HealthResponse;
    const second = (await (
      await GET(new Request("http://localhost:3000/api/health"))
    ).json()) as HealthResponse;

    expect(first.requestId).not.toBe(second.requestId);
  });
});
