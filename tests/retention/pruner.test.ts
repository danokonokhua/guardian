import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getEffectiveRetentionDays,
  pruneOrganizationHistory,
  pruneAllOrganizations,
  pruneSystemMaintenance,
} from "@/services/retention/pruner";
import type { PrismaClient } from "@prisma/client";

describe("History Retention Pruner", () => {
  describe("getEffectiveRetentionDays", () => {
    it("maps Free tier to 7-day grace window", () => {
      expect(getEffectiveRetentionDays("FREE")).toBe(7);
    });

    it("maps Starter tier to 30 days", () => {
      expect(getEffectiveRetentionDays("STARTER")).toBe(30);
    });

    it("maps Growth tier to 90 days", () => {
      expect(getEffectiveRetentionDays("GROWTH")).toBe(90);
    });

    it("maps Pro tier to 365 days (12 months)", () => {
      expect(getEffectiveRetentionDays("PRO")).toBe(365);
    });

    it("maps Agency tier to 365 days (12 months)", () => {
      expect(getEffectiveRetentionDays("AGENCY")).toBe(365);
    });

    it("maps White Label tier to 730 days (24 months)", () => {
      expect(getEffectiveRetentionDays("WHITE_LABEL")).toBe(730);
    });

    it("maps Enterprise tier to Infinity (unlimited)", () => {
      expect(getEffectiveRetentionDays("ENTERPRISE")).toBe(Infinity);
    });

    it("falls back to safe 7-day grace window for unknown plans", () => {
      expect(getEffectiveRetentionDays("NON_EXISTENT_PLAN")).toBe(7);
    });
  });

  describe("pruneOrganizationHistory", () => {
    let mockPrisma: any;
    const now = new Date("2026-10-03T12:00:00Z");

    beforeEach(() => {
      mockPrisma = {
        organization: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
        },
        monitoringResult: {
          findMany: vi.fn(),
          deleteMany: vi.fn(),
          count: vi.fn(),
        },
        healthScore: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
          deleteMany: vi.fn(),
          count: vi.fn(),
        },
        issue: {
          findMany: vi.fn(),
          deleteMany: vi.fn(),
          count: vi.fn(),
        },
        externalDelivery: {
          findMany: vi.fn(),
          deleteMany: vi.fn(),
          count: vi.fn(),
        },
        inAppNotification: {
          findMany: vi.fn(),
          deleteMany: vi.fn(),
          count: vi.fn(),
        },
        authSession: {
          deleteMany: vi.fn(),
        },
        passwordResetToken: {
          deleteMany: vi.fn(),
        },
        authLoginThrottle: {
          deleteMany: vi.fn(),
        },
      };
    });

    it("skips organizations with Enterprise / unlimited retention", async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: "org-enterprise",
        plan: "ENTERPRISE",
        subscription: null,
      });

      const result = await pruneOrganizationHistory(
        "org-enterprise",
        { now },
        mockPrisma as unknown as PrismaClient,
      );

      expect(result.skipped).toBe(true);
      expect(result.retentionDays).toBe(Infinity);
      expect(result.reason).toContain("unlimited");
      expect(mockPrisma.monitoringResult.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.issue.deleteMany).not.toHaveBeenCalled();
    });

    it("prunes records older than 30 days for Starter plan", async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: "org-starter",
        plan: "STARTER",
        subscription: null,
      });

      // 1. Monitoring results: batch of 2 stale items, then empty
      mockPrisma.monitoringResult.findMany
        .mockResolvedValueOnce([{ id: "res-1" }, { id: "res-2" }])
        .mockResolvedValueOnce([]);
      mockPrisma.monitoringResult.deleteMany.mockResolvedValueOnce({ count: 2 });

      // 2. Health scores: latest score exists (score-latest), stale score (score-old)
      mockPrisma.healthScore.findFirst.mockResolvedValueOnce({ id: "score-latest" });
      mockPrisma.healthScore.findMany
        .mockResolvedValueOnce([{ id: "score-old" }])
        .mockResolvedValueOnce([]);
      mockPrisma.healthScore.deleteMany.mockResolvedValueOnce({ count: 1 });

      // 3. Issues: stale resolved issue (issue-old)
      mockPrisma.issue.findMany
        .mockResolvedValueOnce([{ id: "issue-old" }])
        .mockResolvedValueOnce([]);
      mockPrisma.issue.deleteMany.mockResolvedValueOnce({ count: 1 });

      // 4. External deliveries: none
      mockPrisma.externalDelivery.findMany.mockResolvedValueOnce([]);

      // 5. In-app notifications: stale notification
      mockPrisma.inAppNotification.findMany
        .mockResolvedValueOnce([{ id: "notif-1" }])
        .mockResolvedValueOnce([]);
      mockPrisma.inAppNotification.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await pruneOrganizationHistory(
        "org-starter",
        { now, batchSize: 100 },
        mockPrisma as unknown as PrismaClient,
      );

      expect(result.skipped).toBe(false);
      expect(result.retentionDays).toBe(30);
      expect(result.monitoringResultsPruned).toBe(2);
      expect(result.healthScoresPruned).toBe(1);
      expect(result.resolvedIssuesPruned).toBe(1);
      expect(result.notificationsPruned).toBe(1);

      // Verify cutoff date was exactly 30 days before now
      const expectedCutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      expect(result.cutoffDate?.toISOString()).toBe(expectedCutoff.toISOString());

      // Verify issues query only targets RESOLVED or IGNORED statuses
      expect(mockPrisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-starter",
            status: { in: ["RESOLVED", "IGNORED"] },
            resolvedAt: { lt: expectedCutoff },
          }),
        }),
      );

      // Verify latest health score was excluded from deletion
      expect(mockPrisma.healthScore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: "score-latest" },
          }),
        }),
      );
    });

    it("respects dryRun option without deleting data", async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: "org-pro",
        plan: "PRO",
        subscription: null,
      });

      mockPrisma.monitoringResult.count.mockResolvedValueOnce(500);
      mockPrisma.healthScore.count.mockResolvedValueOnce(10);
      mockPrisma.issue.count.mockResolvedValueOnce(5);
      mockPrisma.externalDelivery.count.mockResolvedValueOnce(20);
      mockPrisma.inAppNotification.count.mockResolvedValueOnce(30);

      const result = await pruneOrganizationHistory(
        "org-pro",
        { now, dryRun: true },
        mockPrisma as unknown as PrismaClient,
      );

      expect(result.skipped).toBe(false);
      expect(result.retentionDays).toBe(365);
      expect(result.monitoringResultsPruned).toBe(500);
      expect(result.healthScoresPruned).toBe(9); // Preserves latest score
      expect(result.resolvedIssuesPruned).toBe(5);
      expect(result.externalDeliveriesPruned).toBe(20);
      expect(result.notificationsPruned).toBe(30);

      expect(mockPrisma.monitoringResult.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.issue.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("pruneAllOrganizations", () => {
    it("iterates all organizations and aggregates metrics", async () => {
      const mockPrisma: any = {
        organization: {
          findMany: vi.fn().mockResolvedValueOnce([{ id: "org-1" }, { id: "org-2" }]),
          findUnique: vi
            .fn()
            .mockResolvedValueOnce({ id: "org-1", plan: "STARTER", subscription: null })
            .mockResolvedValueOnce({ id: "org-2", plan: "ENTERPRISE", subscription: null }),
        },
        monitoringResult: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([{ id: "m-1" }])
            .mockResolvedValueOnce([]),
          deleteMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
        },
        healthScore: {
          findFirst: vi.fn().mockResolvedValueOnce(null),
          findMany: vi.fn().mockResolvedValueOnce([]),
        },
        issue: {
          findMany: vi.fn().mockResolvedValueOnce([]),
        },
        externalDelivery: {
          findMany: vi.fn().mockResolvedValueOnce([]),
        },
        inAppNotification: {
          findMany: vi.fn().mockResolvedValueOnce([]),
        },
      };

      const result = await pruneAllOrganizations({}, mockPrisma as unknown as PrismaClient);

      expect(result.totalOrganizations).toBe(2);
      expect(result.organizationsPruned).toBe(1);
      expect(result.organizationsSkipped).toBe(1); // Enterprise skipped
      expect(result.totalMonitoringResultsPruned).toBe(1);
    });
  });

  describe("pruneSystemMaintenance", () => {
    it("deletes expired sessions, reset tokens, and old unblocked throttles", async () => {
      const mockPrisma: any = {
        authSession: {
          deleteMany: vi.fn().mockResolvedValueOnce({ count: 12 }),
        },
        passwordResetToken: {
          deleteMany: vi.fn().mockResolvedValueOnce({ count: 4 }),
        },
        authLoginThrottle: {
          deleteMany: vi.fn().mockResolvedValueOnce({ count: 8 }),
        },
      };

      const now = new Date("2026-10-03T12:00:00Z");
      const result = await pruneSystemMaintenance(
        { now, throttleHours: 24 },
        mockPrisma as unknown as PrismaClient,
      );

      expect(result.expiredSessionsPruned).toBe(12);
      expect(result.expiredResetTokensPruned).toBe(4);
      expect(result.staleLoginThrottlesPruned).toBe(8);

      expect(mockPrisma.authSession.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: now } },
      });

      const expectedThrottleCutoff = new Date(now.getTime() - 24 * 3600 * 1000);
      expect(mockPrisma.authLoginThrottle.deleteMany).toHaveBeenCalledWith({
        where: {
          updatedAt: { lt: expectedThrottleCutoff },
          blockedUntil: null,
        },
      });
    });
  });
});
