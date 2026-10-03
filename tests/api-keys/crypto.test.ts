import { describe, expect, it } from "vitest";
import {
  generateRawApiKey,
  hashApiKey,
  verifyApiKeyHash,
} from "@/services/api-keys/crypto";

describe("API Key Cryptography & SHA-256 Hashing (PRD §20)", () => {
  it("generates live tokens with gdn_live_ prefix and high entropy", () => {
    const { rawToken, keyPrefix } = generateRawApiKey("live");
    expect(rawToken.startsWith("gdn_live_")).toBe(true);
    expect(rawToken.length).toBeGreaterThan(40);
    expect(keyPrefix).toBe(rawToken.slice(0, 14));
  });

  it("generates test tokens with gdn_test_ prefix", () => {
    const { rawToken, keyPrefix } = generateRawApiKey("test");
    expect(rawToken.startsWith("gdn_test_")).toBe(true);
    expect(keyPrefix).toBe(rawToken.slice(0, 14));
  });

  it("produces deterministic 64-char hex SHA-256 hashes", () => {
    const token = "gdn_live_1234567890abcdef1234567890abcdef";
    const hash1 = hashApiKey(token);
    const hash2 = hashApiKey(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);
  });

  it("verifies matching token hash and rejects mismatched or tampered tokens", () => {
    const { rawToken } = generateRawApiKey("live");
    const storedHash = hashApiKey(rawToken);

    expect(verifyApiKeyHash(rawToken, storedHash)).toBe(true);
    expect(verifyApiKeyHash(rawToken + "_tampered", storedHash)).toBe(false);
    expect(verifyApiKeyHash("gdn_live_wrong", storedHash)).toBe(false);
    expect(verifyApiKeyHash("", storedHash)).toBe(false);
  });
});

