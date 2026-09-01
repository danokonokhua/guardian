/**
 * Guardian identity foundation (Phase 1B-05).
 *
 * Types for the application-level identity context and the repository
 * interface through which identity data is read. The User model in
 * db/schema.prisma remains the single source of truth — these types are the
 * narrow, purpose-built projection of it that application services consume
 * (no competing identity system, no auth secrets, no password fields).
 *
 * Flow (mandated by Phase 1B-05 / approved 1A architecture):
 *   AUTH PROVIDER (later phase, e.g. Supabase Auth)
 *         ↓
 *   AUTH ADAPTER            (lib/auth/adapter.ts)
 *         ↓
 *   GUARDIAN IDENTITY CONTEXT (lib/auth/context.ts)
 *         ↓
 *   APPLICATION SERVICES
 */

import type { MemberRole, MemberStatus, UserStatus } from "@prisma/client";

/** Raw identity claim resolved from the request session by the auth adapter. */
export interface AuthenticatedIdentity {
  readonly userId: string;
}

/** Verified application user (projection of the users table). */
export interface AuthenticatedUser {
  readonly userId: string;
  readonly email: string;
  readonly name: string | null;
  readonly status: UserStatus;
}

/** Membership facts for one organization (projection of organization_members). */
export interface MembershipContext {
  readonly organizationId: string;
  readonly role: MemberRole;
  readonly status: MemberStatus;
}

/** Resolved identity: authenticated user plus optional membership context. */
export interface IdentityContext {
  readonly user: AuthenticatedUser;
  readonly membership?: MembershipContext;
}

/**
 * Read-side identity data access. Implementations must be server-only.
 * The Prisma implementation lives in lib/auth/prisma-repository.ts; tests use
 * an in-memory fake (no database required).
 */
export interface IdentityRepository {
  /** Returns the user projection, or null when the user does not exist. */
  findUserById(userId: string): Promise<AuthenticatedUser | null>;
  /** Returns the membership for (user, organization), or null. */
  findMembership(userId: string, organizationId: string): Promise<MembershipContext | null>;
  /** Returns every membership for the user (any status). */
  listMemberships(userId: string): Promise<readonly MembershipContext[]>;
}
