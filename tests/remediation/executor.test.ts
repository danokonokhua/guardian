import { describe, expect, it } from "vitest";
import { validatePipelinePrerequisites, executePipeline } from "@/services/remediation/executor";
import { ForbiddenError } from "@/lib/errors";

describe("Remediation 8-Step Pipeline Executor", () => {
  describe("validatePipelinePrerequisites", () => {
    it("throws ForbiddenError for unapproved HIGH risk actions (PRD §17 Invariant)", () => {
      const highRiskUnapproved: any = {
        title: "Update WordPress Core",
        riskLevel: "HIGH",
        status: "PENDING_APPROVAL",
      };

      expect(() => validatePipelinePrerequisites(highRiskUnapproved)).toThrow(ForbiddenError);
    });

    it("permits approved HIGH risk actions", () => {
      const highRiskApproved: any = {
        title: "Update WordPress Core",
        riskLevel: "HIGH",
        status: "APPROVED",
      };

      expect(() => validatePipelinePrerequisites(highRiskApproved)).not.toThrow();
    });

    it("permits LOW risk actions", () => {
      const lowRisk: any = {
        title: "Purge Edge Cache",
        riskLevel: "LOW",
        status: "APPROVED",
      };

      expect(() => validatePipelinePrerequisites(lowRisk)).not.toThrow();
    });
  });

  describe("executePipeline", () => {
    it("executes action, verifies successfully, and returns COMPLETED with audit log", async () => {
      const action: any = {
        actionType: "INJECT_SECURITY_HEADERS",
        riskLevel: "LOW",
        status: "APPROVED",
        rollbackPlan: {
          originalState: { headersInjected: false },
        },
      };

      const outcome = await executePipeline(action, "usr-test-1");

      expect(outcome.status).toBe("COMPLETED");
      expect(outcome.executionResult.changesApplied).toBe(true);
      expect(outcome.verificationResult.checksPassed).toBe(true);
      expect(outcome.auditEntries.length).toBeGreaterThanOrEqual(3);
      expect(outcome.auditEntries.some((e) => e.action === "VERIFICATION_PASSED")).toBe(true);
    });

    it("automatically triggers rollback if post-execution verification fails", async () => {
      const action: any = {
        actionType: "PURGE_EDGE_CACHE",
        riskLevel: "LOW",
        status: "APPROVED",
        rollbackPlan: {
          originalState: { cachePurged: false },
        },
      };

      const outcome = await executePipeline(action, "usr-test-1", {
        forceVerificationFailure: true,
      });

      expect(outcome.status).toBe("ROLLED_BACK");
      expect(outcome.error).toContain("automated rollback executed");
      expect(outcome.auditEntries.some((e) => e.action === "VERIFICATION_FAILED")).toBe(true);
    });
  });
});
