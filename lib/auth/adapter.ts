import "server-only";

/**
 * Authentication adapter boundary (Phase 1B-05).
 *
 * The ONLY layer allowed to know about sessions, cookies, headers, tokens, or
 * a specific authentication provider. Application code never touches these
 * details — it consumes lib/auth/context.ts.
 *
 * Guardian uses a local PostgreSQL-backed adapter. The adapter boundary stays
 * provider-neutral so a future external provider can still be introduced
 * without leaking session details into application services.
 */

import type { AuthenticatedIdentity } from "@/lib/auth/identity";
import { LocalAuthAdapter } from "@/lib/auth/local-adapter";

/** Contract every authentication provider adapter must satisfy. */
export interface AuthAdapter {
  /**
   * Resolves the identity claimed by the current request session, or null
   * when the request is unauthenticated. MUST NOT perform authorization —
   * membership/role decisions belong to the identity context layer.
   */
  getSessionIdentity(): Promise<AuthenticatedIdentity | null>;
}

/** Fail-closed default used by tests or explicit no-auth wiring. */
export class AnonymousAuthAdapter implements AuthAdapter {
  getSessionIdentity(): Promise<AuthenticatedIdentity | null> {
    return Promise.resolve(null);
  }
}

function defaultAuthAdapter(): AuthAdapter {
  return new LocalAuthAdapter();
}

let authAdapter: AuthAdapter = defaultAuthAdapter();

/**
 * Registers the application auth adapter for tests or a future provider.
 */
export function setAuthAdapter(adapter: AuthAdapter): void {
  authAdapter = adapter;
}

/** Current adapter (exposed for wiring and tests; services should not use it). */
export function getAuthAdapter(): AuthAdapter {
  return authAdapter;
}
