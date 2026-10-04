import { describe, expect, it } from "vitest";
import {
  generateWordpressToken,
  encryptWordpressToken,
  decryptWordpressToken,
} from "@/lib/integrations/wordpress/secrets";

describe("WordPress Secrets & Cryptography", () => {
  it("generates live and sandbox pairing tokens with valid prefixes", () => {
    const live = generateWordpressToken(false);
    expect(live.token).toMatch(/^gcon_live_[a-f0-9]{48}$/);
    expect(live.tokenPrefix).toBe(live.token.substring(0, 18));
    expect(live.tokenPrefix.startsWith("gcon_live_")).toBe(true);

    const sand = generateWordpressToken(true);
    expect(sand.token).toMatch(/^gcon_sand_[a-f0-9]{48}$/);
    expect(sand.tokenPrefix.startsWith("gcon_sand_")).toBe(true);
  });

  it("encrypts and decrypts token roundtrip with AAD context", () => {
    const { token } = generateWordpressToken();
    const context = "org-123:website-456";

    const encrypted = encryptWordpressToken(token, context);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(encrypted.split(".").length).toBe(4);

    const decrypted = decryptWordpressToken(encrypted, context);
    expect(decrypted).toBe(token);
  });

  it("fails to decrypt if context (AAD) does not match", () => {
    const { token } = generateWordpressToken();
    const encrypted = encryptWordpressToken(token, "org-123:website-456");

    expect(() => decryptWordpressToken(encrypted, "wrong-org:website-456")).toThrow(
      /Failed to decrypt WordPress token/,
    );
  });

  it("fails to decrypt tampered ciphertext", () => {
    const { token } = generateWordpressToken();
    const encrypted = encryptWordpressToken(token, "org-123:website-456");
    const parts = encrypted.split(".");
    // Tamper with the ciphertext part
    parts[3] = Buffer.from("tampered_data").toString("base64");
    const tampered = parts.join(".");

    expect(() => decryptWordpressToken(tampered, "org-123:website-456")).toThrow(
      /Failed to decrypt WordPress token/,
    );
  });
});
