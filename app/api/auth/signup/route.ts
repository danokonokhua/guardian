import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonResponse, newRequestId, withRoute } from "@/lib/api";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";
import { registerAccount } from "@/lib/auth/signup";

const signupSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(256),
  name: z.string().trim().min(1).max(120).optional(),
  organizationName: z.string().trim().min(1).max(120).optional(),
});

export const POST = withRoute(async (request) => {
  const input = signupSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return jsonResponse({ error: "Enter a valid name, email, and password." }, 400);
  }

  const account = await registerAccount(input.data);
  const session = await createSession(account.userId);
  const response = NextResponse.json({ ok: true, requestId: newRequestId() }, { status: 201 });
  response.cookies.set({ ...sessionCookieOptions(), value: session.token });
  return response;
});
