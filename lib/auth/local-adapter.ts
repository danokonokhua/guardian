import "server-only";

import { cookies } from "next/headers";

import type { AuthAdapter } from "@/lib/auth/adapter";
import type { AuthenticatedIdentity } from "@/lib/auth/identity";
import { getPrisma } from "@/db/client";
import { hashAuthToken, SESSION_COOKIE_NAME } from "@/lib/auth/tokens";

/** Resolves the opaque Guardian session cookie against PostgreSQL. */
export class LocalAuthAdapter implements AuthAdapter {
  async getSessionIdentity(): Promise<AuthenticatedIdentity | null> {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (token === undefined || token.length < 32) return null;

    const session = await getPrisma().authSession.findUnique({
      where: { tokenHash: hashAuthToken(token) },
      select: { userId: true, expiresAt: true },
    });
    if (session === null) return null;
    if (session.expiresAt <= new Date()) {
      await getPrisma().authSession.deleteMany({ where: { tokenHash: hashAuthToken(token) } });
      return null;
    }
    return { userId: session.userId };
  }
}
