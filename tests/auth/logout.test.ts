import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/logout/route";

vi.mock("@/lib/auth/session", () => ({
  revokeSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "test-session-token" }),
  }),
}));

describe("POST /api/auth/logout", () => {
  it("redirects to public domain instead of container 0.0.0.0 host", async () => {
    const request = new Request("http://0.0.0.0:8080/api/auth/logout", {
      method: "POST",
      headers: {
        "x-forwarded-host": "xxfll06xe9vbsyevnywirktt.129.146.106.126.sslip.io",
        "x-forwarded-proto": "https",
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://xxfll06xe9vbsyevnywirktt.129.146.106.126.sslip.io/",
    );
  });

  it("falls back to public domain if no forwarded headers and container host is 0.0.0.0", async () => {
    const request = new Request("http://0.0.0.0:8080/api/auth/logout", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://xxfll06xe9vbsyevnywirktt.129.146.106.126.sslip.io/",
    );
  });
});
