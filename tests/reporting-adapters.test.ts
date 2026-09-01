import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { createWebhookReportingDestination } from "@/services/reporting/adapters";

describe("reporting adapters", () => {
  it("posts a tenant-scoped signed analytics report", async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const destination = createWebhookReportingDestination({
      url: "https://reports.example.test/guardian",
      signingSecret: "secret",
      transport: { send },
    });
    const report = {
      organizationId: "org-1",
      format: "json" as const,
      content: '{"active":1}',
      generatedAt: "2026-09-01T00:00:00.000Z",
    };
    await destination.deliver(report);
    const init = send.mock.calls[0]![1] as RequestInit;
    const body = String(init.body);
    const expected = createHmac("sha256", "secret").update(body).digest("hex");
    expect(send).toHaveBeenCalledWith("https://reports.example.test/guardian", expect.anything());
    expect((init.headers as Record<string, string>)["x-guardian-signature"]).toBe(
      `sha256=${expected}`,
    );
    expect(body).toContain('"organizationId":"org-1"');
  });

  it("surfaces non-success responses for the job retry policy", async () => {
    const destination = createWebhookReportingDestination({
      url: "https://reports.example.test/guardian",
      signingSecret: "secret",
      transport: { send: vi.fn().mockResolvedValue(new Response(null, { status: 500 })) },
    });
    await expect(
      destination.deliver({
        organizationId: "org-1",
        format: "csv",
        content: "a,b",
        generatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("HTTP 500");
  });

  it("rejects unsupported webhook protocols", () => {
    expect(() =>
      createWebhookReportingDestination({ url: "file:///tmp/report", signingSecret: "secret" }),
    ).toThrow("http or https");
  });
});
