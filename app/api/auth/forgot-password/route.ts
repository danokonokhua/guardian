import { z } from "zod";

import { getPrisma } from "@/db/client";
import { jsonResponse, withRoute } from "@/lib/api";
import { createAuthToken, hashAuthToken, RESET_TOKEN_TTL_MS } from "@/lib/auth/tokens";
import { sendTransactionalEmail } from "@/services/notifications/smtp";
import { serverConfig } from "@/config/server";
import { logger } from "@/lib/logger";

const schema = z.object({ email: z.string().trim().email().toLowerCase() });
const GENERIC_RESPONSE = {
  message: "If an account exists for that email, a reset link has been sent.",
};

export const POST = withRoute(async (request) => {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonResponse({ error: "Enter a valid email address." }, 400);

  const user = await getPrisma().user.findUnique({ where: { email: input.data.email } });
  if (user === null || user.status !== "ACTIVE") return jsonResponse(GENERIC_RESPONSE);

  const recent = await getPrisma().passwordResetToken.findFirst({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      usedAt: null,
    },
  });
  if (recent !== null) return jsonResponse(GENERIC_RESPONSE);

  const token = createAuthToken();
  await getPrisma().passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await getPrisma().passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashAuthToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const baseUrl = serverConfig.public.appUrl ?? "http://localhost:3000";
  const resetUrl = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendTransactionalEmail({
    to: user.email,
    subject: "Reset your Guardian password",
    text: `We received a request to reset your Guardian password.\n\nOpen this link within one hour to choose a new password:\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
  });
  if (!sent) {
    await getPrisma().passwordResetToken.deleteMany({ where: { tokenHash: hashAuthToken(token) } });
    if (serverConfig.appEnv === "local" || serverConfig.appEnv === "development") {
      logger.info("guardian_password_reset_link", { email: user.email, resetUrl });
    }
  }
  return jsonResponse(GENERIC_RESPONSE);
});
