import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { dispatchIssueRecoveryNotifications } from "@/services/issues/recovery";

describe("dispatchIssueRecoveryNotifications", () => {
  it("queues external alerts and dispatches in-app and email recovery notifications", async () => {
    const enqueue = vi.fn().mockResolvedValue("job-123");
    const mockDestinations = [{ id: "dest-1" }, { id: "dest-2" }];
    const mockMembers = [{ userId: "user-1" }, { userId: "user-2" }];
    const mockPreferences = [
      { userId: "user-1", channel: "EMAIL", enabled: true },
      { userId: "user-1", channel: "IN_APP", enabled: true },
      { userId: "user-2", channel: "EMAIL", enabled: false }, // email disabled
      { userId: "user-2", channel: "IN_APP", enabled: true },
    ];

    const inAppCreate = vi.fn().mockResolvedValue({ id: "in-app-1" });
    const externalDeliveryCreateMany = vi.fn().mockResolvedValue({ count: 2 });
    const externalDeliveryFindUnique = vi.fn().mockResolvedValue({ id: "del-1" });
    const destinationFindMany = vi.fn().mockResolvedValue(mockDestinations);
    const memberFindMany = vi.fn().mockResolvedValue(mockMembers);
    const preferenceFindMany = vi.fn().mockResolvedValue(mockPreferences);

    const mockBoss = {
      createQueue: vi.fn().mockResolvedValue(""),
      send: vi.fn().mockResolvedValue("job-ext-1"),
    } as any;

    const tx = {
      notificationDestination: { findMany: destinationFindMany },
      externalDelivery: {
        createMany: externalDeliveryCreateMany,
        findUniqueOrThrow: externalDeliveryFindUnique,
      },
      organizationMember: { findMany: memberFindMany },
      notificationPreference: { findMany: preferenceFindMany },
      inAppNotification: { create: inAppCreate },
    } as unknown as Prisma.TransactionClient;

    const result = await dispatchIssueRecoveryNotifications(
      tx,
      "org-abc",
      {
        id: "issue-999",
        organizationId: "org-abc",
        title: "Checkout form down",
        summary: "Form probe failed with 500.",
        severity: "CRITICAL",
        ruleId: "monitor.form",
        resolvedAt: new Date("2026-10-03T10:00:00Z"),
        resolvedBy: "SYSTEM",
      },
      {
        boss: mockBoss,
        enqueue,
      },
    );

    // External count = 2 destinations
    expect(result.externalCount).toBe(2);
    expect(externalDeliveryCreateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-abc",
        destinationId: "dest-1",
        issueId: "issue-999",
        dedupKey: expect.stringMatching(/^recovery:issue-999:/),
      }),
      skipDuplicates: true,
    });

    // In-app notifications: created for both user-1 and user-2
    expect(inAppCreate).toHaveBeenCalledTimes(2);
    expect(inAppCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-abc",
        userId: "user-1",
        eventType: "ISSUE",
        title: "Resolved: Checkout form down",
        body: "Service has recovered. Checkout form down is now resolved.",
      },
    });

    // Email notification: only enqueued for user-1 (user-2 disabled it)
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-abc",
        issueId: "issue-999",
        recipientUserId: "user-1",
        title: "Resolved: Checkout form down",
        body: expect.stringContaining("Status: Resolved"),
        channel: "EMAIL",
      }),
    );
  });

  it("handles missing external or internal preferences gracefully without failing", async () => {
    const tx = {} as unknown as Prisma.TransactionClient;

    const result = await dispatchIssueRecoveryNotifications(tx, "org-abc", {
      id: "issue-1",
      organizationId: "org-abc",
      title: "Test issue",
      summary: "Test summary",
      severity: "LOW",
      ruleId: "monitor.uptime",
    });

    expect(result).toEqual({ externalCount: 0, internalCount: 0 });
  });
});
