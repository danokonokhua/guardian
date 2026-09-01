import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import type { AuthAdapter } from "@/lib/auth/adapter";
import type { AuthenticatedIdentity } from "@/lib/auth/identity";

/**
 * Supabase Auth adapter for server components and route handlers.
 *
 * Provider/session details stay in this module. Application services consume
 * only the AuthAdapter contract and never read cookies or provider claims.
 */
export class SupabaseAuthAdapter implements AuthAdapter {
  constructor(
    private readonly supabaseUrl: string,
    private readonly supabaseAnonKey: string,
  ) {}

  async getSessionIdentity(): Promise<AuthenticatedIdentity | null> {
    const cookieStore = await cookies();
    const requestHeaders = await headers();
    const supabase = createServerClient(this.supabaseUrl, this.supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server components cannot always mutate cookies. Supabase's
            // refreshed session is still valid for the current request.
          }
        },
      },
    });

    const authorization = requestHeaders.get("authorization");
    const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const { data, error } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();
    if (error !== null || data.user === null) {
      return null;
    }
    return { userId: data.user.id };
  }
}
