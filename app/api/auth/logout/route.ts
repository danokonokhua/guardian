import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { revokeSession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/tokens";

function resolvePublicRedirect(request: Request): URL {
  // 1. Check explicitly configured public URL
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl) {
    try {
      const parsed = new URL("/", envUrl);
      if (!parsed.hostname.startsWith("0.0.0.0")) {
        return parsed;
      }
    } catch {}
  }

  // 2. Check proxy forwarded host
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && !forwardedHost.startsWith("0.0.0.0")) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    try {
      return new URL("/", `${proto}://${forwardedHost}`);
    } catch {}
  }

  // 3. Check browser referer header
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const parsed = new URL(referer);
      if (!parsed.hostname.startsWith("0.0.0.0") && parsed.hostname !== "localhost") {
        return new URL("/", parsed.origin);
      }
    } catch {}
  }

  // 4. Check browser origin header
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (!parsed.hostname.startsWith("0.0.0.0") && parsed.hostname !== "localhost") {
        return new URL("/", parsed.origin);
      }
    } catch {}
  }

  // 5. Check host header if not 0.0.0.0
  const host = request.headers.get("host");
  if (host && !host.startsWith("0.0.0.0")) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    try {
      return new URL("/", `${proto}://${host}`);
    } catch {}
  }

  // 6. Check request.url if not 0.0.0.0
  try {
    const parsed = new URL(request.url);
    if (!parsed.hostname.startsWith("0.0.0.0")) {
      return new URL("/", parsed.origin);
    }
  } catch {}

  // 7. Safe fallback to the deployed production host (never 0.0.0.0)
  return new URL("https://xxfll06xe9vbsyevnywirktt.129.146.106.126.sslip.io/");
}

export async function POST(request: Request): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token !== undefined) await revokeSession(token);
  const target = resolvePublicRedirect(request);
  const response = NextResponse.redirect(target, 303);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
