import { beforeEach, describe, expect, it } from "vitest";
import {
  checkApiKeyRateLimit,
  getRateLimitHeaders,
  resetRateLimitsForTesting,
} from "@/services/api-keys/rate-limiter";

describe("API Key Token-Bucket Sliding Window Rate Limiter (PRD §19)", () => {
  beforeEach(() => {
    resetRateLimitsForTesting();
  });

  it("permits requests within the rate limit budget", () => {
    const keyId = "test-key-1";
    const limit = 5;
    const now = 1_000_000;

    for (let i = 0; i < limit; i++) {
      const result = checkApiKeyRateLimit(keyId, limit, now + i * 100);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(limit - (i + 1));
      expect(result.limit).toBe(limit);
    }
  });

  it("blocks requests that exceed the rate limit budget", () => {
    const keyId = "test-key-2";
    const limit = 3;
    const now = 1_000_000;

    // Use up budget
    checkApiKeyRateLimit(keyId, limit, now);
    checkApiKeyRateLimit(keyId, limit, now + 100);
    const lastAllowed = checkApiKeyRateLimit(keyId, limit, now + 200);
    expect(lastAllowed.allowed).toBe(true);
    expect(lastAllowed.remaining).toBe(0);

    // Exceed budget
    const blocked = checkApiKeyRateLimit(keyId, limit, now + 300);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.reset).toBeGreaterThan(Math.floor(now / 1000));
  });

  it("recovers budget after the 60-second window expires", () => {
    const keyId = "test-key-3";
    const limit = 2;
    const t0 = 1_000_000;

    checkApiKeyRateLimit(keyId, limit, t0);
    checkApiKeyRateLimit(keyId, limit, t0 + 100);
    expect(checkApiKeyRateLimit(keyId, limit, t0 + 200).allowed).toBe(false);

    // 61 seconds later
    const tAfter = t0 + 61_000;
    const recovered = checkApiKeyRateLimit(keyId, limit, tAfter);
    expect(recovered.allowed).toBe(true);
    expect(recovered.remaining).toBe(1);
  });

  it("formats standard RFC HTTP headers correctly", () => {
    const headers = getRateLimitHeaders({
      allowed: true,
      limit: 120,
      remaining: 119,
      reset: 1727960000,
    });

    expect(headers["X-RateLimit-Limit"]).toBe("120");
    expect(headers["X-RateLimit-Remaining"]).toBe("119");
    expect(headers["X-RateLimit-Reset"]).toBe("1727960000");
  });
});
