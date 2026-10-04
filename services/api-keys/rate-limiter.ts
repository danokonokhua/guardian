import { RateLimitResult } from "./types";

interface WindowRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, WindowRecord>();
const WINDOW_DURATION_MS = 60_000; // 1 minute sliding window

/**
 * Checks and records an API request against a sliding 60-second window.
 */
export function checkApiKeyRateLimit(
  keyId: string,
  limitPerMinute: number,
  now: number = Date.now(),
): RateLimitResult {
  const windowStart = now - WINDOW_DURATION_MS;

  let record = rateLimitStore.get(keyId);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(keyId, record);
  }

  // Prune timestamps outside current 60s sliding window
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  const oldest = record.timestamps[0];
  const resetUnixSeconds =
    oldest !== undefined
      ? Math.ceil((oldest + WINDOW_DURATION_MS) / 1000)
      : Math.ceil((now + WINDOW_DURATION_MS) / 1000);

  if (record.timestamps.length >= limitPerMinute) {
    return {
      allowed: false,
      limit: limitPerMinute,
      remaining: 0,
      reset: resetUnixSeconds,
    };
  }

  record.timestamps.push(now);
  const remaining = Math.max(0, limitPerMinute - record.timestamps.length);

  return {
    allowed: true,
    limit: limitPerMinute,
    remaining,
    reset: resetUnixSeconds,
  };
}

/**
 * Formats standard RFC rate limit HTTP headers.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
}

/**
 * Resets the in-memory rate limit store for testing purposes.
 */
export function resetRateLimitsForTesting(): void {
  rateLimitStore.clear();
}
