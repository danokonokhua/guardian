import { describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
vi.mock("@/db/client", () => ({ getPrisma: () => ({ organizationMember: { findFirst } }) }));
vi.mock("@/db/tenant", () => ({
  withGucContext: vi.fn((_scope: unknown, callback: (tx: unknown) => unknown) =>
    callback({ organizationMember: { findFirst } }),
  ),
}));
import {
  createEmailNotificationProvider,
  enqueueNotification,
  registerNotificationWorker,
} from "@/lib/notifications";

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

  it("maps notification events to a vendor-neutral email adapter", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const provider = createEmailNotificationProvider({ send });
    await provider.deliver({
      organizationId: "o",
      issueId: "i",
      recipientUserId: "u@example.test",
      title: "SLA breach",
      body: "Issue requires attention.",
      channel: "EMAIL",
    });
    expect(send).toHaveBeenCalledWith({
      to: "u@example.test",
      subject: "SLA breach",
      text: "Issue requires attention.",
      organizationId: "o",
      issueId: "i",
    });
  });
});
