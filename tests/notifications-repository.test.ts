import { describe, expect, it, vi } from "vitest";

const tx = {
  $executeRaw: vi.fn().mockResolvedValue(0),
  notificationPreference: { findUnique: vi.fn(), upsert: vi.fn() },
  inAppNotification: { create: vi.fn(), findMany: vi.fn() },
};
vi.mock("@/db/client", () => ({
  getPrisma: () => ({ $transaction: (fn: (x: typeof tx) => unknown) => fn(tx) }),
}));
import {
  createInAppNotification,
  isChannelEnabled,
  listInAppNotifications,
  setPreference,
} from "@/services/notifications/repository";

const scope = { organizationId: "o1", userId: "u1", role: "OWNER" as const };

describe("notification repository", () => {
  it("defaults missing preferences to enabled", async () => {
    tx.notificationPreference.findUnique.mockResolvedValue(null);
    await expect(isChannelEnabled(scope, "u1", "ISSUE_OPENED", "EMAIL")).resolves.toBe(true);
  });
  it("upserts a tenant preference", async () => {
    tx.notificationPreference.upsert.mockResolvedValue({ enabled: false });
    await setPreference(scope, "u1", "ISSUE_OPENED", "EMAIL", false);
    expect(tx.notificationPreference.upsert).toHaveBeenCalled();
  });
  it("creates and lists in-app notifications for the tenant", async () => {
    tx.inAppNotification.create.mockResolvedValue({ id: "n1" });
    tx.inAppNotification.findMany.mockResolvedValue([{ id: "n1" }]);
    await expect(
      createInAppNotification(scope, {
        userId: "u1",
        eventType: "ISSUE_OPENED",
        title: "t",
        body: "b",
      }),
    ).resolves.toEqual({ id: "n1" });
    await expect(listInAppNotifications(scope, "u1")).resolves.toHaveLength(1);
  });
});
