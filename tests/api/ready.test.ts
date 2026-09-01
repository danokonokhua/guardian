import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/ready/route";

/**
 * Readiness endpoint (application + database) — exercised without a live
 * database: in the test environment DATABASE_URL is unset, so the expected
 * result is application=healthy, database=unconfigured, overall=degraded,
 * HTTP 200 (the database remains optional until Phase 1B-04).
 */

describe("GET /api/health/ready", () => {
  it("returns 200 with separated application and database health", async () => {
    const response = await GET(new Request("http://localhost:3000/api/health/ready"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as {
      status: string;
      checks: {
        application: { status: string };
        database: { status: string };
      };
      requestId: string;
      timestamp: string;
    };

    expect(body.status).toBe("degraded");
    expect(body.checks.application.status).toBe("healthy");
    expect(body.checks.database.status).toBe("unconfigured");
    expect(typeof body.requestId).toBe("string");
    expect(typeof body.timestamp).toBe("string");
  });

  it("never discloses database connection details", async () => {
    const response = await GET(new Request("http://localhost:3000/api/health/ready"));
    const raw = await response.text();

    expect(raw).not.toContain("DATABASE_URL");
    expect(raw).not.toContain("postgresql://");
    expect(raw).not.toContain("DIRECT_URL");
    expect(raw).not.toContain("password");
  });
});
