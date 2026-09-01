import "server-only";

/**
 * Tenant-scoped database access (Phase 1B-07).
 *
 * The database is the FINAL security backstop:
 *
 *   application authorization (lib/auth) — primary
 *   PostgreSQL GUC + RLS            — defense in depth
 *
 * Design rules:
 * - NO AsyncLocalStorage, NO process-global mutable tenant state. The tenant
 *   scope is an explicit, serializable value passed by the caller. This is
 *   deliberately the same shape a future background job will carry in its
 *   payload.
 * - GUCs (`app.org_id`, `app.user_id`) are set with `set_config(..., true)` —
 *   transaction-LOCAL only, never session/global.
 * - All SQL is static, parameterized tagged-template SQL. Tenant IDs are
 *   NEVER concatenated into SQL text.
 */

import type { MemberRole, Prisma } from "@prisma/client";

import type { OrganizationContext } from "@/lib/auth/context";
import { getPrisma } from "@/db/client";

/** Transaction-capable Prisma surface used by the helpers below. */
export type PrismaTxClient = Prisma.TransactionClient;

/**
 * Minimal host surface the helpers need: anything exposing an interactive
 * (callback) $transaction — the full PrismaClient satisfies this structurally,
 * and test fakes can implement it without weakening production typing.
 */
export interface PrismaTransactionHost {
  $transaction<TResult>(callback: (tx: PrismaTxClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * Explicit tenant scope for database operations. Serializable by design
 * (plain data) so background jobs can carry it verbatim in payloads.
 */
export interface TenantScope {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: MemberRole;
}

/** Row-security GUC values applied inside a transaction. */
export interface GucContext {
  readonly organizationId?: string;
  readonly userId?: string;
}

/**
 * Builds a frozen TenantScope from an authorized OrganizationContext (the
 * Phase 1B-05 boundary). The membership has already been verified ACTIVE for
 * exactly this organization — this function performs no I/O and no re-trust
 * of client input.
 */
export function createTenantScope(context: OrganizationContext): TenantScope {
  return Object.freeze({
    organizationId: context.organizationId,
    userId: context.user.userId,
    role: context.membership.role,
  });
}

/**
 * Runs `callback` inside a Prisma transaction with the transaction-local
 * `app.org_id` and `app.user_id` GUCs set from the scope. The callback
 * receives ONLY the transaction-scoped client — there is no unscoped escape
 * hatch from this helper. PostgreSQL RLS policies (see
 * db/migrations/20260828100000_tenant_rls) read these GUCs to filter rows.
 *
 * Note: `app.org_id`/`app.user_id` values are passed as PARAMETERS ($1) —
 * never interpolated into the SQL text.
 */
export async function withTenantTransaction<TResult>(
  scope: TenantScope,
  callback: (tx: PrismaTxClient) => Promise<TResult>,
  client: PrismaTransactionHost = getPrisma(),
): Promise<TResult> {
  return withGucContext(
    { organizationId: scope.organizationId, userId: scope.userId },
    callback,
    client,
  );
}

/**
 * Low-level GUC-scoped transaction used by the identity bootstrap (authorization
 * reads that must work under FORCE RLS before a full TenantScope exists —
 * e.g. resolving a user's membership). At least one of organizationId/userId
 * must be provided; absent GUCs are simply not set (RLS then denies rows that
 * require them — fail-closed).
 */
export async function withGucContext<TResult>(
  guc: GucContext,
  callback: (tx: PrismaTxClient) => Promise<TResult>,
  client: PrismaTransactionHost = getPrisma(),
): Promise<TResult> {
  if (guc.organizationId === undefined && guc.userId === undefined) {
    throw new Error("withGucContext requires an organizationId and/or userId.");
  }
  return client.$transaction(async (tx) => {
    if (guc.organizationId !== undefined) {
      await tx.$executeRaw`SELECT set_config('app.org_id', ${guc.organizationId}, true)`;
    }
    if (guc.userId !== undefined) {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${guc.userId}, true)`;
    }
    return callback(tx);
  });
}
