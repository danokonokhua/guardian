/**
 * Authentication adapter boundary (Phase 1B-05).
 *
 * The ONLY layer allowed to know about sessions, cookies, headers, tokens, or
 * a specific authentication provider. Application code never touches these
 * details — it consumes lib/auth/context.ts.
 *
 * No provider is wired yet by design: Supabase Auth is the approved provider
 * for a later phase. Until an adapter is registered, the default ANONYMOUS
 * adapter resolves no identity — every request is unauthenticated and the
 * system fails closed (deny-by-default).
 */

import type { AuthenticatedIdentity } from "@/lib/auth/identity";

/** Contract every authentication provider adapter must satisfy. */
export interface AuthAdapter {
  /**
   * Resolves the identity claimed by the current request session, or null
   * when the request is unauthenticated. MUST NOT perform authorization —
   * membership/role decisions belong to the identity context layer.
   */
  getSessionIdentity(): Promise<AuthenticatedIdentity | null>;
}

/** Fail-closed default: no provider wired → no identity, ever. */
export class AnonymousAuthAdapter implements AuthAdapter {
  getSessionIdentity(): Promise<AuthenticatedIdentity | null> {
    return Promise.resolve(null);
  }
}

let authAdapter: AuthAdapter = new AnonymousAuthAdapter();

/**
 * Registers the application auth adapter. Called once during auth-provider
 * wiring (later phase) or by tests to simulate authenticated sessions.
 */
export function setAuthAdapter(adapter: AuthAdapter): void {
  authAdapter = adapter;
}

/** Current adapter (exposed for wiring and tests; services should not use it). */
export function getAuthAdapter(): AuthAdapter {
  return authAdapter;
}
