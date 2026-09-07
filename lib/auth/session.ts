import "server-only";

import { getPrisma } from "@/db/client";
import {
  createAuthToken,
  hashAuthToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/lib/auth/tokens";
import { serverConfig } from "@/config/server";

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: serverConfig.public.appUrl?.startsWith("https://") ?? false,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = createAuthToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getPrisma().authSession.create({
    data: { userId, tokenHash: hashAuthToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  await getPrisma().authSession.deleteMany({ where: { tokenHash: hashAuthToken(token) } });
}
