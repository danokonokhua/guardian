import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertCanUseAiCoo } from "@/lib/billing/entitlements";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { getCooDirectivesOverview, executeCooDirective } from "@/services/ai-coo/service";
import * as repository from "@/services/ai-coo/repository";

vi.mock("@/services/ai-coo/repository");

const mockTenantScope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  userId: "user-test-coo",
  role: "ADMIN" as const,
};

describe("AI COO Service & Execution Lifecycle (PRD §16, §17, §23, §25)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Plan Entitlement Gating", () => {
    it("blocks FREE, STARTER, and GROWTH plans from AI COO Executive Directives", () => {
      expect(() => assertCanUseAiCoo("FREE")).toThrow(ForbiddenError);
      expect(() => assertCanUseAiCoo("STARTER")).toThrow(ForbiddenError);
      expect(() => assertCanUseAiCoo("GROWTH")).toThrow(ForbiddenError);
    });

    it("allows PRO, AGENCY, WHITE_LABEL, and ENTERPRISE tiers", () => {
      expect(() => assertCanUseAiCoo("PRO")).not.toThrow();
      expect(() => assertCanUseAiCoo("AGENCY")).not.toThrow();
      expect(() => assertCanUseAiCoo("WHITE_LABEL")).not.toThrow();
      expect(() => assertCanUseAiCoo("ENTERPRISE")).not.toThrow();
    });
  });

  describe("Executive Overview Rollup", () => {
    it("aggregates directives and calculates financial upside and urgent briefings", async () => {
      vi.spyOn(repository, "listCooDirectivesByOrg").mockResolvedValue([
        {
          id: "dir-1",
          organizationId: mockTenantScope.organizationId,
          websiteId: "w-1",
          category: "REVENUE_PROTECTION",
          priorityTier: "P0_IMMEDIATE",
          urgencyScore: 98,
          title: "Critical Lead Fix",
          executiveSummary: "Lost revenue",
          businessImpactUsd: 5000,
          effortEstimation: "LOW_EFFORT",
          operationalAction: "Fix",
          autoFixAvailable: true,
          status: "PENDING",
          approvedById: null,
          approvedAt: null,
          executedAt: null,
          executionResult: {},
          crossDomainEvidence: {},
          generatedAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "dir-2",
          organizationId: mockTenantScope.organizationId,
          websiteId: "w-1",
          category: "CONVERSION_RATE",
          priorityTier: "P1_THIS_WEEK",
          urgencyScore: 82,
          title: "Core Web Vitals",
          executiveSummary: "Faster pages",
          businessImpactUsd: 2500,
          effortEstimation: "MODERATE_EFFORT",
          operationalAction: "Cache",
          autoFixAvailable: true,
          status: "PENDING",
          approvedById: null,
          approvedAt: null,
          executedAt: null,
          executionResult: {},
          crossDomainEvidence: {},
          generatedAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const overview = await getCooDirectivesOverview(mockTenantScope, "PRO");

      expect(overview.totalDirectives).toBe(2);
      expect(overview.p0ImmediateCount).toBe(1);
      expect(overview.p1ThisWeekCount).toBe(1);
      expect(overview.totalOpportunityValueUsd).toBe(7500);
      expect(overview.executiveBriefingSummary).toContain("Urgent");
    });
  });

  describe("Directive Approval & Execution Lifecycle", () => {
    it("approves directive with operator audit tracking", async () => {
      vi.spyOn(repository, "findCooDirectiveById").mockResolvedValue({
        id: "dir-1",
        organizationId: mockTenantScope.organizationId,
        websiteId: null,
        category: "REVENUE_PROTECTION",
        priorityTier: "P0_IMMEDIATE",
        urgencyScore: 98,
        title: "T",
        executiveSummary: "E",
        businessImpactUsd: 1000,
        effortEstimation: "LOW_EFFORT",
        operationalAction: "A",
        autoFixAvailable: true,
        status: "PENDING",
        approvedById: null,
        approvedAt: null,
        executedAt: null,
        executionResult: {},
        crossDomainEvidence: {},
        generatedAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(repository, "updateCooDirectiveStatusRecord").mockResolvedValue({
        id: "dir-1",
        status: "APPROVED",
      } as any);

      const result = await executeCooDirective(mockTenantScope, "dir-1", "APPROVE");
      expect(result.status).toBe("APPROVED");
      expect(repository.updateCooDirectiveStatusRecord).toHaveBeenCalledWith(
        mockTenantScope,
        "dir-1",
        expect.objectContaining({
          status: "APPROVED",
          approvedById: mockTenantScope.userId,
        }),
      );
    });

    it("executes directive autonomously with audit timestamp and impact capture", async () => {
      vi.spyOn(repository, "findCooDirectiveById").mockResolvedValue({
        id: "dir-1",
        organizationId: mockTenantScope.organizationId,
        websiteId: null,
        category: "REVENUE_PROTECTION",
        priorityTier: "P0_IMMEDIATE",
        urgencyScore: 98,
        title: "T",
        executiveSummary: "E",
        businessImpactUsd: 1000,
        effortEstimation: "LOW_EFFORT",
        operationalAction: "Deploy form handler",
        autoFixAvailable: true,
        status: "APPROVED",
        approvedById: mockTenantScope.userId,
        approvedAt: new Date(),
        executedAt: null,
        executionResult: {},
        crossDomainEvidence: {},
        generatedAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(repository, "updateCooDirectiveStatusRecord").mockResolvedValue({
        id: "dir-1",
        status: "EXECUTED",
      } as any);

      const result = await executeCooDirective(mockTenantScope, "dir-1", "EXECUTE");
      expect(result.status).toBe("EXECUTED");
      expect(repository.updateCooDirectiveStatusRecord).toHaveBeenCalledWith(
        mockTenantScope,
        "dir-1",
        expect.objectContaining({
          status: "EXECUTED",
          executionResult: expect.objectContaining({
            success: true,
            businessImpactCapturedUsd: 1000,
          }),
        }),
      );
    });

    it("throws NotFoundError when directive is not found", async () => {
      vi.spyOn(repository, "findCooDirectiveById").mockResolvedValue(null);

      await expect(executeCooDirective(mockTenantScope, "missing-dir", "EXECUTE")).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
