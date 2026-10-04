import { describe, expect, it } from "vitest";
import { encryptPluginCredentials, decryptPluginCredentials } from "@/services/marketplace/crypto";

describe("Marketplace AES-256-GCM Credential Encryption (PRD §20 & §21)", () => {
  const tenantContext = "org-1234:slack-notifications";
  const credentials = {
    webhookUrl: "https://hooks.slack.com/services/T00/B00/X00",
    apiToken: "xoxb-secret-token",
  };

  it("encrypts credentials into versioned v1.iv.tag.ciphertext format", () => {
    const encrypted = encryptPluginCredentials(credentials, tenantContext);
    expect(typeof encrypted).toBe("string");
    const parts = encrypted.split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    // Verify base64 components
    expect(parts[1]!.length).toBeGreaterThan(0);
    expect(parts[2]!.length).toBeGreaterThan(0);
    expect(parts[3]!.length).toBeGreaterThan(0);
  });

  it("decrypts ciphertext back to identical credential payload", () => {
    const encrypted = encryptPluginCredentials(credentials, tenantContext);
    const decrypted = decryptPluginCredentials(encrypted, tenantContext);

    expect(decrypted).toEqual(credentials);
  });

  it("fails to decrypt if tenant context (AAD) differs (prevent cross-tenant hijacking)", () => {
    const encrypted = encryptPluginCredentials(credentials, tenantContext);
    const attackerContext = "org-attacker:slack-notifications";

    expect(() => decryptPluginCredentials(encrypted, attackerContext)).toThrow();
  });

  it("fails to decrypt if ciphertext is corrupted or tampered", () => {
    const encrypted = encryptPluginCredentials(credentials, tenantContext);
    const [v, iv, tag, cipher] = encrypted.split(".");
    expect(cipher).toBeDefined();
    const tamperedCipher = cipher!.slice(0, -4) + "AAAA";
    const corrupted = [v, iv, tag, tamperedCipher].join(".");

    expect(() => decryptPluginCredentials(corrupted, tenantContext)).toThrow();
  });
});
