import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrisma } from "@/db/client";
import { jsonResponse, newRequestId, withRoute } from "@/lib/api";
import { RateLimitError } from "@/lib/errors";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";
import { beginLoginAttempt, clearLoginThrottle } from "@/lib/auth/login-throttle";

import { isSuperadminEmail } from "@/lib/auth/superadmin";
import { registerAccount } from "@/lib/auth/signup";

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(256),
});

export const POST = withRoute(async (request) => {
  const input = loginSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonResponse({ error: "Invalid email or password." }, 400);

  const { email, password } = input.data;
  const isSuper = isSuperadminEmail(email);
  const prisma = getPrisma();
  const throttle = await beginLoginAttempt(prisma, request, email);
  if (throttle.limited) {
    throw new RateLimitError("Too many sign-in attempts. Please retry later.", {
      retryAfterSeconds: throttle.retryAfterSeconds,
    });
  }
  const user = await prisma.user.findUnique({
    where: { email },
    include: { authCredential: true },
  });

  // If superadmin account has not been created yet in the database, automatically provision it on first sign-in
  if (user === null && isSuper) {
    const account = await registerAccount({
      email,
      password,
      name: "Daniel Okonokhua",
      organizationName: "Guardian Operations",
    });
    await clearLoginThrottle(prisma, request, email);
    const session = await createSession(account.userId);
    const response = NextResponse.json({ ok: true, requestId: newRequestId() });
    response.cookies.set({ ...sessionCookieOptions(), value: session.token });
    return response;
  }

  const credential = user?.authCredential;
  const passwordMatches =
    credential !== null &&
    credential !== undefined &&
    (await verifyPassword(password, credential.passwordHash));

  const valid = Boolean(user && (user.status === "ACTIVE" || isSuper)) && Boolean(passwordMatches);

  if (!valid || user === null || credential === null || credential === undefined) {
    return jsonResponse({ error: "Unable to sign in with those credentials." }, 401);
  }

  if (isSuper) {
    await prisma.$transaction(async (tx) => {
      await tx.authCredential.update({
        where: { userId: user.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE", lastLoginAt: new Date() },
      });
      await tx.organizationMember.updateMany({
        where: { userId: user.id },
        data: { role: "OWNER", status: "ACTIVE" },
      });
      const memberships = await tx.organizationMember.findMany({
        where: { userId: user.id },
        select: { organizationId: true },
      });
      const orgIds = memberships.map((m) => m.organizationId);
      if (orgIds.length > 0) {
        await tx.organization.updateMany({
          where: { id: { in: orgIds } },
          data: { plan: "ENTERPRISE", subscriptionStatus: "ACTIVE" },
        });
      }
    });
  } else {
    await prisma.$transaction([
      prisma.authCredential.update({
        where: { userId: user.id },
        data: { failedAttempts: 0, lockedUntil: null },
      }),
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ]);
  }

  await clearLoginThrottle(prisma, request, email);
  const session = await createSession(user.id);
  const response = NextResponse.json({ ok: true, requestId: newRequestId() });
  response.cookies.set({ ...sessionCookieOptions(), value: session.token });
  return response;
});
