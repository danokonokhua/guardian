import crypto from "crypto";

const KEY_PREFIX_LENGTH = 14;

/**
 * Generates a cryptographically strong API token.
 * Example format: gdn_live_4f81c9a03b57e12693ab34c7...
 */
export function generateRawApiKey(environment: "live" | "test" = "live"): {
  rawToken: string;
  keyPrefix: string;
} {
  const entropy = crypto.randomBytes(24).toString("hex");
  const rawToken = `gdn_${environment}_${entropy}`;
  const keyPrefix = rawToken.slice(0, KEY_PREFIX_LENGTH);
  return { rawToken, keyPrefix };
}

/**
 * Computes a secure SHA-256 hash of the raw token for database storage.
 * Raw API keys are NEVER stored plaintext per PRD Section 20.
 */
export function hashApiKey(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Constant-time comparison between raw token hash and stored hash to resist timing attacks.
 */
export function verifyApiKeyHash(rawToken: string, storedHash: string): boolean {
  if (!rawToken || !storedHash) return false;
  const computedHash = hashApiKey(rawToken);
  try {
    const a = Buffer.from(computedHash, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
