import { describe, expect, it, vi } from "vitest";
import { normalizeCompetitorUrl, registerCompetitor } from "@/services/competitors/service";
import * as repo from "@/services/competitors/repository";
import { ValidationError, ConflictError, ForbiddenError } from "@/lib/errors";

describe("Competitor Intelligence Service", () => {
  describe("normalizeCompetitorUrl", () => {
    it("normalizes domain and targetUrl correctly", () => {
      expect(normalizeCompetitorUrl("example.com")).toEqual({
        domain: "example.com",
        targetUrl: "https://example.com",
      });
      expect(normalizeCompetitorUrl("http://rival.io/landing/page?ref=123")).toEqual({
        domain: "rival.io",
        targetUrl: "http://rival.io/landing/page",
      });
      expect(normalizeCompetitorUrl("  https://Sub.Competitor.Co.UK/  ")).toEqual({
        domain: "sub.competitor.co.uk",
        targetUrl: "https://sub.competitor.co.uk",
      });
    });
    it("throws ValidationError for invalid domains", () => {
      expect(() => normalizeCompetitorUrl("")).toThrow(ValidationError);
      expect(() => normalizeCompetitorUrl("localhost")).toThrow(ValidationError);
      expect(() => normalizeCompetitorUrl("invalid_domain_without_tld")).toThrow(ValidationError);
    });
  });

  describe("registerCompetitor", () => {
    const scope = { organizationId: "org-test-1", userId: "usr-1", role: "OWNER" as const };

    it("throws ForbiddenError for plans without competitor intelligence entitlement", async () => {
      await expect(
        registerCompetitor(scope, { name: "Acme", urlOrDomain: "acme.com", planId: "FREE" }),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        registerCompetitor(scope, { name: "Acme", urlOrDomain: "acme.com", planId: "STARTER" }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ValidationError if name is empty", async () => {
      await expect(
        registerCompetitor(scope, { name: "   ", urlOrDomain: "acme.com", planId: "PRO" }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ConflictError if domain is already monitored in org", async () => {
      const findSpy = vi
        .spyOn(repo, "findCompetitorByDomain")
        .mockResolvedValue({ id: "comp-1", domain: "rival.com" } as any);
      await expect(
        registerCompetitor(scope, {
          name: "Rival",
          urlOrDomain: "https://rival.com",
          planId: "PRO",
        }),
      ).rejects.toThrow(ConflictError);
      findSpy.mockRestore();
    });
  });
});
