import { describe, expect, it, vi } from "vitest";

import { enqueueSystemPing } from "@/lib/jobs/system-ping";

function createBossMock() {
  return {
    send: vi.fn(),
    work: vi.fn(),
  } as never;
}

describe("system.ping job", () => {
  it("uses pg-boss singleton submission and retry policy", async () => {
    const boss = createBossMock();
    const send = (boss as { send: ReturnType<typeof vi.fn> }).send;
    send.mockResolvedValue("job-123");

    const result = await enqueueSystemPing(boss);

    expect(result).toEqual({ jobId: "job-123", deduplicated: false });
    expect(send).toHaveBeenCalledOnce();
    const [name, payload, options] = send.mock.calls[0] as [
      string,
      { source: string; enqueuedAt: string },
      {
        retryLimit: number;
        retryDelay: number;
        retryBackoff: boolean;
        expireInSeconds: number;
        singletonKey?: string;
      },
      string,
    ];
    expect(name).toBe("system.ping");
    expect(payload.source).toBe("cron");
    expect(typeof payload.enqueuedAt).toBe("string");
    expect(options).toMatchObject({
      retryLimit: 2,
      retryDelay: 5,
      retryBackoff: true,
      expireInSeconds: 60,
    });
    expect(options.singletonKey).toBe("system-ping");
  });

  it("reports a duplicate submission without treating it as an error", async () => {
    const boss = createBossMock();
    const send = (boss as { send: ReturnType<typeof vi.fn> }).send;
    send.mockResolvedValue(null);

    await expect(enqueueSystemPing(boss)).resolves.toEqual({
      jobId: null,
      deduplicated: true,
    });
  });
});
