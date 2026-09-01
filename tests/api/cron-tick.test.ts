import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/jobs/system-ping", () => ({
  enqueueSystemPing: vi.fn(),
}));

vi.mock("@/config/server", async () => {
  const actual = await vi.importActual<typeof import("@/config/server")>("@/config/server");
  return {
    ...actual,
    serverConfig: {
      ...actual.serverConfig,
      server: { ...actual.serverConfig.server, cronSecret: "test-cron-secret" },
    },
  };
});

import { POST } from "@/app/api/cron/tick/route";
import { enqueueSystemPing } from "@/lib/jobs/system-ping";

const mockedEnqueue = vi.mocked(enqueueSystemPing);

describe("POST /api/cron/tick", () => {
  it("rejects requests without the cron secret", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/cron/tick", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("rejects an incorrect cron secret", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/cron/tick", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("accepts the configured secret and submits the foundation job", async () => {
    mockedEnqueue.mockResolvedValueOnce({ jobId: "job-123", deduplicated: false });

    const response = await POST(
      new Request("http://localhost:3000/api/cron/tick", {
        method: "POST",
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(202);
    expect(mockedEnqueue).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      data: { jobId: "job-123", deduplicated: false },
    });
  });
});
