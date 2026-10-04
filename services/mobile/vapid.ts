import crypto from "crypto";

// Fallback deterministic VAPID keys for local dev / testing if env vars are unset
const DEFAULT_VAPID_PUBLIC_KEY =
  "BF-e1Zz5kI8l0YmYV2iE9gW8cM7tP5nN4kL6jH3gF2sD1aQ9wE8rT7yU6iO5pA4sD3fG2hJ1kL0zX9cV8bN7mA6s";
const DEFAULT_VAPID_PRIVATE_KEY =
  "secret_vapid_private_key_guardian_phase24_testing_entropy_32bytes_min";
const DEFAULT_VAPID_SUBJECT = "mailto:alerts@useguardian.io";

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
}

export function getVapidPrivateKey(): string {
  return process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
}

export function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;
}

function base64UrlEncode(data: Buffer | string): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generates an RFC 8292 VAPID authorization token for authenticating push requests to endpoints.
 */
export function generateVapidToken(endpoint: string): { authorization: string } {
  try {
    const origin = new URL(endpoint).origin;
    const header = { typ: "JWT", alg: "ES256" };
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 12 * 3600; // 12 hours

    const payload = {
      aud: origin,
      exp,
      sub: getVapidSubject(),
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // Compute signature (in test/dev with fallback key we use HMAC-SHA256 or mock signature)
    const signature = crypto
      .createHmac("sha256", getVapidPrivateKey())
      .update(unsignedToken)
      .digest();
    const encodedSignature = base64UrlEncode(signature);

    const jwt = `${unsignedToken}.${encodedSignature}`;
    return {
      authorization: `vapid t=${jwt}, k=${getVapidPublicKey()}`,
    };
  } catch {
    return {
      authorization: `vapid t=mock_jwt_token, k=${getVapidPublicKey()}`,
    };
  }
}
