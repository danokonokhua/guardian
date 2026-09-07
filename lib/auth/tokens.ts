import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "guardian_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function createAuthToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
