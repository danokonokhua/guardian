import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceAuditRateLimit: vi.fn(),
  getPrisma: vi.fn(),
  runFreeAudit: vi.fn(),
}));

vi.mock("@/lib/audit/rate-limit", () => ({ enforceAuditRateLimit: mocks.enforceAuditRateLimit }));
vi.mock("@/db/client", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("@/lib/audit/service", () => ({ runFreeAudit: mocks.runFreeAudit }));

import { POST } from "@/app/api/audit/route";

function request(payload: unknown) {
  return new Request("http://localhost/api/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPrisma.mockReturnValue({});
    mocks.runFreeAudit.mockResolvedValue({ url: "https://example.com/", score: { score: 70 } });
  });

  it("rate-limits before running the bounded audit and returns the result", async () => {
    const response = await POST(request({ url: " https://example.com " }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { url: "https://example.com/" } });
    expect(mocks.enforceAuditRateLimit).toHaveBeenCalledWith(
      {},
      expect.any(Request),
      "https://example.com/",
    );
    expect(mocks.runFreeAudit).toHaveBeenCalledWith("https://example.com/");
  });

  it("rejects malformed and credential-bearing URLs without touching the database", async () => {
    const malformed = await POST(request({ url: "not-a-url" }));
    const credentialed = await POST(request({ url: "https://user:password@example.com" }));

    expect(malformed.status).toBe(400);
    expect(credentialed.status).toBe(400);
    expect(mocks.getPrisma).not.toHaveBeenCalled();
    expect(mocks.enforceAuditRateLimit).not.toHaveBeenCalled();
    expect(mocks.runFreeAudit).not.toHaveBeenCalled();
  });
});
