import { z } from "zod";

import { getPrisma } from "@/db/client";
import { jsonResponse, withRoute } from "@/lib/api";
import { hashAuthToken } from "@/lib/auth/tokens";
import { hashPassword, validatePassword } from "@/lib/auth/password";

const schema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(1).max(256),
});

export const POST = withRoute(async (request) => {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonResponse({ error: "Invalid reset request." }, 400);
  const passwordError = validatePassword(input.data.password);
  if (passwordError !== null) return jsonResponse({ error: passwordError }, 400);

  const tokenHash = hashAuthToken(input.data.token);
  const now = new Date();
  const existing = await getPrisma().passwordResetToken.findUnique({ where: { tokenHash } });
  if (existing === null || existing.usedAt !== null || existing.expiresAt <= now) {
    return jsonResponse({ error: "This reset link is invalid or has expired." }, 400);
  }
  const passwordHash = await hashPassword(input.data.password);
  const changed = await getPrisma().$transaction(async (tx) => {
    const reset = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    if (reset === null || reset.usedAt !== null || reset.expiresAt <= now) return false;
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;
    await tx.authCredential.update({
      where: { userId: reset.userId },
      data: { passwordHash, failedAttempts: 0, lockedUntil: null, passwordUpdatedAt: now },
    });
    await tx.authSession.deleteMany({ where: { userId: reset.userId } });
    return true;
  });

  if (!changed) return jsonResponse({ error: "This reset link is invalid or has expired." }, 400);
  return jsonResponse({ ok: true });
});
