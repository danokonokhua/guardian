import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrisma } from "@/db/client";
import { jsonResponse, newRequestId, withRoute } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(256),
});

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export const POST = withRoute(async (request) => {
  const input = loginSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonResponse({ error: "Invalid email or password." }, 400);

  const { email, password } = input.data;
  const user = await getPrisma().user.findUnique({
    where: { email },
    include: { authCredential: true },
  });
  const credential = user?.authCredential;
  const locked =
    credential?.lockedUntil !== null &&
    credential?.lockedUntil !== undefined &&
    credential.lockedUntil > new Date();
  const valid =
    user?.status === "ACTIVE" &&
    credential !== null &&
    credential !== undefined &&
    !locked &&
    (await verifyPassword(password, credential.passwordHash));

  if (!valid || user === null || credential === null || credential === undefined) {
    if (credential !== null && credential !== undefined && !locked) {
      const failedAttempts = credential.failedAttempts + 1;
      await getPrisma().authCredential.update({
        where: { userId: credential.userId },
        data: {
          failedAttempts,
          ...(failedAttempts >= LOCK_THRESHOLD
            ? { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS), failedAttempts: 0 }
            : {}),
        },
      });
    }
    return jsonResponse({ error: "Unable to sign in with those credentials." }, 401);
  }

  await getPrisma().$transaction([
    getPrisma().authCredential.update({
      where: { userId: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    }),
    getPrisma().user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);
  const session = await createSession(user.id);
  const response = NextResponse.json({ ok: true, requestId: newRequestId() });
  response.cookies.set({ ...sessionCookieOptions(), value: session.token });
  return response;
});
