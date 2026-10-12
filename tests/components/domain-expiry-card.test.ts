import { describe, expect, it } from "vitest";
import { calculateDaysRemaining } from "@/components/dashboard/domain-expiry-card";

describe("DomainExpiryCard helper", () => {
  it("calculates positive remaining days accurately", () => {
    const base = "2026-10-12T00:00:00Z";
    const expires = "2026-11-01T00:00:00Z";
    const days = calculateDaysRemaining(expires, base);
    expect(days).toBe(20);
  });

  it("calculates 0 or negative days when expired", () => {
    const base = "2026-10-12T00:00:00Z";
    const expires = "2026-10-10T00:00:00Z";
    const days = calculateDaysRemaining(expires, base);
    expect(days).toBeLessThanOrEqual(0);
  });

  it("handles null/undefined gracefully", () => {
    expect(calculateDaysRemaining(undefined)).toBeNull();
    expect(calculateDaysRemaining("invalid-date")).toBeNull();
  });
});

