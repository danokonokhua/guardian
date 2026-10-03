import { describe, expect, it, vi } from "vitest";
import {
  normalizeClientDomain,
  registerAgencyClient,
  bulkScanPortfolio,
  saveAgencyBranding,
} from "@/services/agency/service";
import * as repo from "@/services/agency/repository";
import { ValidationError, ConflictError, ForbiddenError } from "@/lib/errors";

describe("Agency Platform Service", () => {
  const scope = { organizationId: "org-agency-1", userId: "usr-1", role: "OWNER" as const };

  describe("normalizeClientDomain", () => {
    it("normalizes domains and strips protocols and paths", () => {
      expect(normalizeClientDomain("client.com")).toBe("client.com");
      expect(normalizeClientDomain("https://CLIENT.COM/")).toBe("client.com");
      expect(normalizeClientDomain("http://sub.domain.co.uk/path?ref=123")).toBe("sub.domain.co.uk");
    });

    it("throws ValidationError for invalid domains", () => {
      expect(() => normalizeClientDomain("")).toThrow(ValidationError);
      expect(() => normalizeClientDomain("localhost")).toThrow(ValidationError);
      expect(() => normalizeClientDomain("invalid_tld")).toThrow(ValidationError);
    });
  });

  describe("registerAgencyClient", () => {
    it("throws ForbiddenError for non-agency plans", async () => {
      await expect(
        registerAgencyClient(scope, {
          clientName: "Acme",
          clientDomain: "acme.com",
          planId: "FREE",
        }),
      ).rejects.toThrow(ForbiddenError);

      await expect(
        registerAgencyClient(scope, {
          clientName: "Acme",
          clientDomain: "acme.com",
          planId: "PRO",
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ValidationError for empty client name", async () => {
      await expect(
        registerAgencyClient(scope, {
          clientName: "   ",
          clientDomain: "acme.com",
          planId: "AGENCY",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ConflictError if client domain is already monitored in agency", async () => {
      const findSpy = vi
        .spyOn(repo, "findAgencyClientByDomain")
        .mockResolvedValue({ id: "client-1", clientDomain: "acme.com" } as any);

      await expect(
        registerAgencyClient(scope, {
          clientName: "Acme Duplicate",
          clientDomain: "acme.com",
          planId: "AGENCY",
        }),
      ).rejects.toThrow(ConflictError);

      findSpy.mockRestore();
    });
  });

  describe("bulkScanPortfolio & branding entitlements", () => {
    it("throws ForbiddenError for bulk scans on unsupported plans", async () => {
      await expect(
        bulkScanPortfolio(scope, { planId: "FREE" }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ForbiddenError for white-label branding on unsupported plans", async () => {
      await expect(
        saveAgencyBranding(scope, { companyName: "Agency", planId: "STARTER" }),
      ).rejects.toThrow(ForbiddenError);
    });
  });
});

