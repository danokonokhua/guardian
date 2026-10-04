import { describe, expect, it } from "vitest";
import {
  encryptGoogleCredentials,
  decryptGoogleCredentials,
} from "@/lib/integrations/google/secrets";

describe("Google Credentials Encryption (AES-256-GCM)", () => {
  const credentials = {
    accessToken: "ya29.test_access_token_12345",
    refreshToken: "1//test_refresh_token_67890",
    tokenExpiry: Date.now() + 3600000,
    propertyId: "properties/12345678",
    propertyName: "Production Web Stream",
    accountEmail: "owner@company.com",
  };

  const context = "org_test_123:GA4";

  it("encrypts and decrypts credentials successfully", () => {
    const encrypted = encryptGoogleCredentials(credentials, context);
    expect(encrypted).toContain("v1.");

    const decrypted = decryptGoogleCredentials(encrypted, context);
    expect(decrypted.accessToken).toBe(credentials.accessToken);
    expect(decrypted.refreshToken).toBe(credentials.refreshToken);
    expect(decrypted.propertyId).toBe(credentials.propertyId);
    expect(decrypted.propertyName).toBe(credentials.propertyName);
    expect(decrypted.accountEmail).toBe(credentials.accountEmail);
  });

  it("fails decryption if context AAD differs", () => {
    const encrypted = encryptGoogleCredentials(credentials, context);
    expect(() => decryptGoogleCredentials(encrypted, "different_org:GA4")).toThrow(
      "Google integration credentials could not be decrypted.",
    );
  });

  it("fails decryption if ciphertext is tampered", () => {
    const encrypted = encryptGoogleCredentials(credentials, context);
    const tampered = encrypted.slice(0, -4) + "AAAA";
    expect(() => decryptGoogleCredentials(tampered, context)).toThrow(
      "Google integration credentials could not be decrypted.",
    );
  });
});
