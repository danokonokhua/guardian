import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ConflictError } from "@/lib/errors";

function getMarketplaceKey(): Buffer {
  const raw =
    process.env.MARKETPLACE_ENCRYPTION_KEY ||
    process.env.NOTIFICATION_ENCRYPTION_KEY ||
    "";

  if (!raw || raw.length < 32) {
    // Return a deterministically derived key for testing/dev environments if unset
    return Buffer.from(
      "guardian_marketplace_enc_key_32_bytes_ok!",
      "utf8"
    ).subarray(0, 32);
  }

  // If base64-encoded 32-byte key:
  if (/^[A-Za-z0-9+/]{43}=$/.test(raw)) {
    return Buffer.from(raw, "base64");
  }

  return Buffer.from(raw, "utf8").subarray(0, 32);
}

/**
 * Encrypts sensitive plugin credentials using AES-256-GCM.
 * Context is passed as Authenticated Additional Data (AAD) to prevent ciphertext transplantation across tenants.
 */
export function encryptPluginCredentials(
  credentials: Record<string, unknown>,
  tenantContext: string
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getMarketplaceKey(), iv);
  cipher.setAAD(Buffer.from(tenantContext, "utf8"));

  const plaintext = JSON.stringify(credentials);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Decrypts AES-256-GCM encrypted plugin credentials.
 */
export function decryptPluginCredentials(
  payload: string,
  tenantContext: string
): Record<string, unknown> {
  try {
    const [version, ivStr, tagStr, cipherStr] = payload.split(".");
    if (version !== "v1" || !ivStr || !tagStr || !cipherStr) {
      throw new Error("Invalid payload format");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      getMarketplaceKey(),
      Buffer.from(ivStr, "base64")
    );
    decipher.setAAD(Buffer.from(tenantContext, "utf8"));
    decipher.setAuthTag(Buffer.from(tagStr, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherStr, "base64")),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(decrypted) as Record<string, unknown>;
  } catch {
    throw new ConflictError("Plugin credentials could not be decrypted.");
  }
}
