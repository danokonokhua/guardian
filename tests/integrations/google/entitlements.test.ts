import { describe, expect, it } from "vitest";
import { assertCanUseGoogleIntegrations } from "@/lib/billing/entitlements";
import { ForbiddenError } from "@/lib/errors";

describe("Google Integrations Entitlements", () => {
  it("allows PRO, AGENCY, WHITE_LABEL, and ENTERPRISE plans", () => {
    expect(() => assertCanUseGoogleIntegrations("PRO")).not.toThrow();
    expect(() => assertCanUseGoogleIntegrations("AGENCY")).not.toThrow();
    expect(() => assertCanUseGoogleIntegrations("WHITE_LABEL")).not.toThrow();
    expect(() => assertCanUseGoogleIntegrations("ENTERPRISE")).not.toThrow();
  });

  it("blocks FREE, STARTER, and GROWTH plans with ForbiddenError", () => {
    expect(() => assertCanUseGoogleIntegrations("FREE")).toThrow(ForbiddenError);
    expect(() => assertCanUseGoogleIntegrations("STARTER")).toThrow(ForbiddenError);
    expect(() => assertCanUseGoogleIntegrations("GROWTH")).toThrow(ForbiddenError);
  });
});

