import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { revokeSession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/tokens";

export async function POST(request: Request): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token !== undefined) await revokeSession(token);
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
