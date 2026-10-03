import { describe, expect, it } from "vitest";
import { assertCanUseWordpressConnect } from "@/lib/billing/entitlements";
import { ForbiddenError } from "@/lib/errors";

describe("WordPress Connect Entitlements", () => {
  it("allows STARTER, GROWTH, PRO, AGENCY, WHITE_LABEL, and ENTERPRISE plans", () => {
    expect(() => assertCanUseWordpressConnect("STARTER")).not.toThrow();
    expect(() => assertCanUseWordpressConnect("GROWTH")).not.toThrow();
    expect(() => assertCanUseWordpressConnect("PRO")).not.toThrow();
    expect(() => assertCanUseWordpressConnect("AGENCY")).not.toThrow();
    expect(() => assertCanUseWordpressConnect("WHITE_LABEL")).not.toThrow();
    expect(() => assertCanUseWordpressConnect("ENTERPRISE")).not.toThrow();
  });

  it("blocks FREE plan with ForbiddenError for live connections", () => {
    expect(() => assertCanUseWordpressConnect("FREE")).toThrow(ForbiddenError);
  });
});
