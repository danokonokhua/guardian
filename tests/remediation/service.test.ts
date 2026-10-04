import { describe, expect, it, vi } from "vitest";
import {
  proposeRemediation,
  approveAndExecuteRemediation,
  rollbackRemediation,
  rejectRemediation,
} from "@/services/remediation/service";
import * as repo from "@/services/remediation/repository";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

describe("Automated Remediation Service", () => {
  const scope = { organizationId: "org-rem-1", userId: "usr-1", role: "OWNER" as const };

  describe("proposeRemediation", () => {
    it("throws ForbiddenError for plans without automated remediation entitlement", async () => {
      await expect(
        proposeRemediation(scope, {
          actionType: "PURGE_EDGE_CACHE",
          problem: "Slow TTFB",
          planId: "FREE",
        }),
      ).rejects.toThrow(ForbiddenError);

      await expect(
        proposeRemediation(scope, {
          actionType: "PURGE_EDGE_CACHE",
          problem: "Slow TTFB",
          planId: "STARTER",
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("stages HIGH risk actions in PENDING_APPROVAL without auto-executing", async () => {
      const mockAction: any = {
        id: "act-high-1",
        actionType: "UPDATE_WORDPRESS_CORE",
        riskLevel: "HIGH",
        status: "PENDING_APPROVAL",
        autoExecutable: false,
      };

      const createSpy = vi.spyOn(repo, "createRemediationAction").mockResolvedValue(mockAction);

      const action = await proposeRemediation(scope, {
        actionType: "UPDATE_WORDPRESS_CORE",
        problem: "Outdated core",
        planId: "PRO",
      });

      expect(action.status).toBe("PENDING_APPROVAL");
      expect(action.riskLevel).toBe("HIGH");

      createSpy.mockRestore();
    });
  });

  describe("approveAndExecuteRemediation", () => {
    it("throws NotFoundError if action does not exist", async () => {
      const findSpy = vi.spyOn(repo, "findRemediationActionById").mockResolvedValue(null);

      await expect(
        approveAndExecuteRemediation(scope, "non-existent-action", "usr-1"),
      ).rejects.toThrow(NotFoundError);

      findSpy.mockRestore();
    });

    it("approves and completes remediation action", async () => {
      const mockPending: any = {
        id: "act-1",
        actionType: "INJECT_SECURITY_HEADERS",
        riskLevel: "LOW",
        status: "PENDING_APPROVAL",
        rollbackPlan: { originalState: {} },
      };

      const mockApproved: any = {
        ...mockPending,
        status: "APPROVED",
      };

      const mockCompleted: any = {
        ...mockApproved,
        status: "COMPLETED",
      };

      vi.spyOn(repo, "findRemediationActionById").mockResolvedValue(mockPending);
      vi.spyOn(repo, "updateRemediationAction")
        .mockResolvedValueOnce(mockApproved)
        .mockResolvedValueOnce(mockCompleted);
      vi.spyOn(repo, "appendAuditEntries").mockResolvedValue(mockCompleted);

      const result = await approveAndExecuteRemediation(scope, "act-1", "usr-admin");

      expect(result.status).toBe("COMPLETED");
      vi.restoreAllMocks();
    });
  });

  describe("rollbackRemediation & rejectRemediation", () => {
    it("updates status to ROLLED_BACK", async () => {
      const mockAction: any = { id: "act-1", status: "COMPLETED" };
      vi.spyOn(repo, "findRemediationActionById").mockResolvedValue(mockAction);
      vi.spyOn(repo, "appendAuditEntries").mockResolvedValue(mockAction);
      vi.spyOn(repo, "updateRemediationAction").mockResolvedValue({
        ...mockAction,
        status: "ROLLED_BACK",
      });

      const res = await rollbackRemediation(scope, "act-1", "Tested rollback", "usr-1");
      expect(res.status).toBe("ROLLED_BACK");
      vi.restoreAllMocks();
    });

    it("updates status to REJECTED", async () => {
      const mockAction: any = { id: "act-1", status: "PENDING_APPROVAL" };
      vi.spyOn(repo, "findRemediationActionById").mockResolvedValue(mockAction);
      vi.spyOn(repo, "appendAuditEntries").mockResolvedValue(mockAction);
      vi.spyOn(repo, "updateRemediationAction").mockResolvedValue({
        ...mockAction,
        status: "REJECTED",
      });

      const res = await rejectRemediation(scope, "act-1", "Not required", "usr-1");
      expect(res.status).toBe("REJECTED");
      vi.restoreAllMocks();
    });
  });
});
