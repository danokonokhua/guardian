import "server-only";

/**
 * Guardian identity context — the application-facing authentication and
 * authorization boundary (Phase 1B-05).
 *
 * Services consume ONLY these functions; they never touch cookies, headers,
 * tokens, or auth-provider APIs (those live behind lib/auth/adapter.ts).
 *
 * Authorization model (deny-by-default):
 * - Unauthenticated → 401 UnauthorizedError.
 * - Authenticated but not an ACTIVE member of the requested organization
 *   → 404 NotFoundError (organization existence is never revealed; this also
 *   masks cross-tenant probing).
 * - Member but below the required role → 403 ForbiddenError.
 *
 * Client-supplied userId / organizationId are NEVER treated as proof of
 * authorization: the authenticated identity (adapter) and the membership
 * relationship (repository) decide.
 */

import type { MemberRole } from "@prisma/client";

import { hasAtLeastRole, isActiveMembership, isActiveUser } from "@/lib/auth/authorization";
import type {
  AuthenticatedUser,
  IdentityContext,
  IdentityRepository,
  MembershipContext,
} from "@/lib/auth/identity";
import { getAuthAdapter } from "@/lib/auth/adapter";
import { prismaIdentityRepository } from "@/lib/auth/prisma-repository";
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";

let identityRepository: IdentityRepository = prismaIdentityRepository;

/** Wiring/testing seam: swaps the identity data source (defaults to Prisma). */
export function setIdentityRepository(repository: IdentityRepository): void {
  identityRepository = repository;
}

/**
 * Resolves the current identity, or null when the request is unauthenticated
 * or the claimed identity no longer maps to an ACTIVE user (stale/removed
 * identities fail closed).
 */
export async function getCurrentUser(): Promise<IdentityContext | null> {
  const identity = await getAuthAdapter().getSessionIdentity();
  if (identity === null) {
    return null;
  }
  const user = await identityRepository.findUserById(identity.userId);
  if (user === null || !isActiveUser(user)) {
    return null;
  }
  return { user };
}

/** Requires an authenticated, ACTIVE user; throws 401 otherwise. */
export async function requireUser(): Promise<AuthenticatedUser> {
  const context = await getCurrentUser();
  if (context === null) {
    throw new UnauthorizedError();
  }
  return context.user;
}

/** An identity resolved against one specific organization. */
export interface OrganizationContext {
  readonly user: AuthenticatedUser;
  readonly membership: MembershipContext;
  readonly organizationId: string;
}

/**
 * Requires an ACTIVE membership of `organizationId` for the authenticated
 * user. Non-members and inactive members receive 404 (existence masking).
 */
export async function requireOrganizationMember(
  organizationId: string,
): Promise<OrganizationContext> {
  const user = await requireUser();
  const membership = await identityRepository.findMembership(user.userId, organizationId);
  if (membership === null || !isActiveMembership(membership)) {
    throw new NotFoundError("Organization");
  }
  return { user, membership, organizationId };
}

/**
 * Requires ACTIVE membership with at least `minimum` role in the
 * organization. Membership failure → 404; insufficient role → 403.
 */
export async function requireRole(
  organizationId: string,
  minimum: MemberRole,
): Promise<OrganizationContext> {
  const context = await requireOrganizationMember(organizationId);
  if (!hasAtLeastRole(context.membership, minimum)) {
    throw new ForbiddenError(`This action requires the ${minimum} role or higher.`);
  }
  return context;
}

/**
 * Binds an identity + membership into an immutable tenant context, verifying
 * the membership actually belongs to the requested organization. A mismatch
 * is an invariant violation (programming error), never a silent tenant
 * switch — it throws instead of returning a usable context.
 */
export function tenantContextFor(
  user: AuthenticatedUser,
  membership: MembershipContext,
  organizationId: string,
): OrganizationContext {
  if (membership.organizationId !== organizationId || !isActiveMembership(membership)) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Tenant context mismatch: membership does not authorize this organization.",
    });
  }
  return Object.freeze({ user, membership, organizationId });
}
