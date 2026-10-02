import { describe, it, expect } from "vitest";
import {
  assertCanAddWebsite,
  assertCanAddBusiness,
  assertCanAddMember,
  assertCanUseFeature,
} from "@/lib/billing/entitlements";
import { getPlanDefinition, getPlanLimits, getPlanFeatures } from "@/config/billing-plans";
import { ForbiddenError } from "@/lib/errors";

describe("Billing & Plan Entitlements", () => {
  it("provides plan definitions and limits for all PRD tiers", () => {
    const tiers = ["FREE", "STARTER", "GROWTH", "PRO", "AGENCY", "WHITE_LABEL", "ENTERPRISE"];
    for (const tier of tiers) {
      const plan = getPlanDefinition(tier);
      expect(plan.id).toBe(tier);
      expect(plan.name).toBeDefined();
      const limits = getPlanLimits(tier);
      expect(limits.maxWebsites).toBeGreaterThan(0);
      expect(limits.maxBusinesses).toBeGreaterThan(0);
      expect(limits.maxTeamMembers).toBeGreaterThan(0);
      const features = getPlanFeatures(tier);
      expect(features).toBeDefined();
    }
  });

  describe("assertCanAddWebsite", () => {
    it("allows adding website within plan limit", () => {
      expect(() => assertCanAddWebsite(0, "FREE")).not.toThrow();
      expect(() => assertCanAddWebsite(4, "GROWTH")).not.toThrow();
      expect(() => assertCanAddWebsite(9, "PRO")).not.toThrow();
    });

    it("throws ForbiddenError when plan limit is reached", () => {
      expect(() => assertCanAddWebsite(1, "FREE")).toThrow(ForbiddenError);
      expect(() => assertCanAddWebsite(1, "STARTER")).toThrow(ForbiddenError);
      expect(() => assertCanAddWebsite(5, "GROWTH")).toThrow(ForbiddenError);
      expect(() => assertCanAddWebsite(10, "PRO")).toThrow(ForbiddenError);
      expect(() => assertCanAddWebsite(25, "AGENCY")).toThrow(ForbiddenError);
    });
  });

  describe("assertCanAddBusiness", () => {
    it("allows adding business profile within limit", () => {
      expect(() => assertCanAddBusiness(0, "FREE")).not.toThrow();
      expect(() => assertCanAddBusiness(2, "GROWTH")).not.toThrow();
    });

    it("throws ForbiddenError when business limit is reached", () => {
      expect(() => assertCanAddBusiness(1, "FREE")).toThrow(ForbiddenError);
      expect(() => assertCanAddBusiness(3, "GROWTH")).toThrow(ForbiddenError);
      expect(() => assertCanAddBusiness(10, "PRO")).toThrow(ForbiddenError);
    });
  });

  describe("assertCanAddMember", () => {
    it("allows adding team member within limit", () => {
      expect(() => assertCanAddMember(0, "FREE")).not.toThrow();
      expect(() => assertCanAddMember(1, "STARTER")).not.toThrow();
      expect(() => assertCanAddMember(4, "GROWTH")).not.toThrow();
    });

    it("throws ForbiddenError when seat limit is reached", () => {
      expect(() => assertCanAddMember(1, "FREE")).toThrow(ForbiddenError);
      expect(() => assertCanAddMember(2, "STARTER")).toThrow(ForbiddenError);
      expect(() => assertCanAddMember(5, "GROWTH")).toThrow(ForbiddenError);
    });
  });

  describe("assertCanUseFeature", () => {
    it("correctly evaluates feature availability per plan", () => {
      expect(() => assertCanUseFeature("PRO", "syntheticFormTests")).not.toThrow();
      expect(() => assertCanUseFeature("FREE", "syntheticFormTests")).toThrow(ForbiddenError);
      expect(() => assertCanUseFeature("STARTER", "syntheticFormTests")).toThrow(ForbiddenError);

      expect(() => assertCanUseFeature("AGENCY", "agencyBranding")).not.toThrow();
      expect(() => assertCanUseFeature("GROWTH", "agencyBranding")).toThrow(ForbiddenError);
    });
  });
});
