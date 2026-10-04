import { describe, expect, it, vi } from "vitest";
import { registerCampaign, recordCampaignMetrics } from "@/services/marketing/service";
import * as repo from "@/services/marketing/repository";
import { ValidationError, ConflictError, ForbiddenError } from "@/lib/errors";

describe("Marketing Intelligence Service", () => {
  const scope = { organizationId: "org-mkt-1", userId: "usr-1", role: "OWNER" as const };

  describe("registerCampaign", () => {
    it("throws ForbiddenError for plans without marketing intelligence entitlement", async () => {
      await expect(
        registerCampaign(scope, {
          name: "Search",
          channel: "GOOGLE_ADS",
          planId: "FREE",
        }),
      ).rejects.toThrow(ForbiddenError);

      await expect(
        registerCampaign(scope, {
          name: "Search",
          channel: "GOOGLE_ADS",
          planId: "STARTER",
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ValidationError for empty name or invalid channel", async () => {
      await expect(
        registerCampaign(scope, {
          name: "  ",
          channel: "GOOGLE_ADS",
          planId: "PRO",
        }),
      ).rejects.toThrow(ValidationError);

      await expect(
        registerCampaign(scope, {
          name: "Search",
          channel: "INVALID_CHANNEL",
          planId: "PRO",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ConflictError if external campaign ID is already registered on channel", async () => {
      const findSpy = vi
        .spyOn(repo, "findCampaignByExternalId")
        .mockResolvedValue({ id: "camp-existing", name: "Existing" } as any);

      await expect(
        registerCampaign(scope, {
          name: "Search duplicate",
          channel: "GOOGLE_ADS",
          externalCampaignId: "ext-123",
          planId: "PRO",
        }),
      ).rejects.toThrow(ConflictError);

      findSpy.mockRestore();
    });
  });
});
