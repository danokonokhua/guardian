import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ConflictError } from "@/lib/errors";
function key() {
  const raw = process.env.NOTIFICATION_ENCRYPTION_KEY ?? "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(raw) || Buffer.from(raw, "base64").length !== 32)
    throw new ConflictError(
      "Notification destination encryption is not configured on this server.",
    );
  return Buffer.from(raw, "base64");
}
export function encryptDestination(
  value: { url: string; signingSecret?: string },
  context: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}
export function decryptDestination(
  value: string,
  context: string,
): { url: string; signingSecret?: string } {
  try {
    const [version, iv, tag, ciphertext] = value.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext) throw Error();
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    );
  } catch {
    throw Error("Notification credentials could not be decrypted.");
  }
}
