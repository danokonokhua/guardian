import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface GeneratedWordpressToken {
  token: string;
  tokenPrefix: string;
}

export function generateWordpressToken(isSandbox = false): GeneratedWordpressToken {
  const prefixType = isSandbox ? "gcon_sand_" : "gcon_live_";
  const secretPart = randomBytes(24).toString("hex");
  const token = `${prefixType}${secretPart}`;
  // Prefix for fast database lookup (first 18 chars, e.g. 'gcon_live_a1b2c3d4')
  const tokenPrefix = token.substring(0, 18);
  return { token, tokenPrefix };
}

function getKey(): Buffer {
  const raw =
    process.env.WORDPRESS_INTEGRATION_ENCRYPTION_KEY ||
    process.env.NOTIFICATION_ENCRYPTION_KEY ||
    "";

  if (/^[A-Za-z0-9+/]{43}=$/.test(raw) && Buffer.from(raw, "base64").length === 32) {
    return Buffer.from(raw, "base64");
  }

  // Derive a fallback 32-byte key from app secret/session secret if specific base64 key is not set
  const salt =
    process.env.APP_SECRET ||
    process.env.SESSION_SECRET ||
    "guardian-wordpress-integrations-secret";
  return createHash("sha256").update(salt).digest();
}

/**
 * Encrypts a WordPress pairing token or credential with AES-256-GCM.
 * Context string is bound as Additional Authenticated Data (AAD) to prevent transposition.
 */
export function encryptWordpressToken(token: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
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
 * Decrypts a WordPress pairing token and verifies AAD.
 */
export function decryptWordpressToken(envelope: string, context: string): string {
  try {
    const [version, iv, tag, ciphertext] = envelope.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext) {
      throw new Error("Invalid credential envelope");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(iv, "base64"),
    );
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error(
      `Failed to decrypt WordPress token: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}
