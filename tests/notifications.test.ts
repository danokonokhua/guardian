import { describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
vi.mock("@/db/client", () => ({ getPrisma: () => ({ organizationMember: { findFirst } }) }));
import { enqueueNotification, registerNotificationWorker } from "@/lib/notifications";

describe("notifications", () => {
  it("creates a retryable deduplicated delivery job", async () => {
    const mock = { createQueue: vi.fn(), send: vi.fn().mockResolvedValue("j1") };
    const boss = mock as never;
    await expect(
      enqueueNotification(
        {
          organizationId: "o",
          issueId: "i",
          recipientUserId: "u",
          title: "t",
          body: "b",
          channel: "EMAIL",
        },
        boss,
      ),
    ).resolves.toBe("j1");
    expect(mock.createQueue).toHaveBeenCalled();
    expect(mock.send).toHaveBeenCalledWith(
      "notification.deliver",
      expect.any(Object),
      expect.objectContaining({ retryLimit: 3, singletonKey: "i:u:EMAIL" }),
    );
  });

  it("delivers only to active members", async () => {
    const work = vi.fn();
    const boss = { createQueue: vi.fn(), work } as never;
    const provider = { deliver: vi.fn().mockResolvedValue(undefined) };
    findFirst.mockResolvedValue({ id: "m" });
    await registerNotificationWorker(boss, provider);
    await (work.mock.calls[0]![1] as (jobs: unknown[]) => Promise<void>)([
      {
        data: {
          organizationId: "o",
          issueId: "i",
          recipientUserId: "u",
          title: "t",
          body: "b",
          channel: "EMAIL",
        },
      },
    ]);
    expect(provider.deliver).toHaveBeenCalledOnce();
  });
});
