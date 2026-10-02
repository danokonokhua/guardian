import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface GoogleEncryptedCredentials {
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: number; // epoch ms
  scope?: string;
  propertyId?: string;
  propertyName?: string;
  accountEmail?: string;
}

function getKey(): Buffer {
  const raw =
    process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY ||
    process.env.NOTIFICATION_ENCRYPTION_KEY ||
    "";

  if (/^[A-Za-z0-9+/]{43}=$/.test(raw) && Buffer.from(raw, "base64").length === 32) {
    return Buffer.from(raw, "base64");
  }

  // Derive a fallback 32-byte key from app secret/session secret if specific base64 key is not set
  const salt = process.env.APP_SECRET || process.env.SESSION_SECRET || "guardian-google-integrations-secret";
  return createHash("sha256").update(salt).digest();
}

export function encryptGoogleCredentials(
  value: GoogleEncryptedCredentials,
  context: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);

  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decryptGoogleCredentials(
  value: string,
  context: string,
): GoogleEncryptedCredentials {
  try {
    const [version, iv, tag, ciphertext] = value.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext) {
      throw new Error("Invalid credential envelope");
    }

    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(decrypted) as GoogleEncryptedCredentials;
  } catch {
    throw new Error("Google integration credentials could not be decrypted.");
  }
}

