import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { loadPublicConfig } from "@/config/public";

/**
 * Refreshes the Supabase session cookie before protected server rendering.
 * Authorization still happens in lib/auth/context.ts; this boundary only
 * keeps the provider session current across dashboard/API requests.
 */
export async function proxy(request: NextRequest) {
  const config = loadPublicConfig();
  if (config.supabaseUrl === undefined || config.supabaseAnonKey === undefined) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response = NextResponse.next({ request });
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/v1/:path*"],
};
