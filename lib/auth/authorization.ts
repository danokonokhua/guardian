/**
 * Role-aware authorization foundation (Phase 1B-05).
 *
 * Deny-by-default. The full Guardian permission matrix (Phase 1A §10) arrives
 * with the API phase; this module establishes the reusable primitives:
 * authenticated check, membership-status check, and minimum-rank role checks
 * over the approved roles OWNER > ADMIN > MEMBER > VIEWER.
 *
 * Every helper returns false / throws for unknown input — absence of evidence
 * never authorizes anything.
 */

import type { MemberRole } from "@prisma/client";

import type { AuthenticatedUser, MembershipContext } from "@/lib/auth/identity";

/** Ordinal rank of the approved roles. Higher = more privileged. */
const ROLE_RANK: Readonly<Record<MemberRole, number>> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

/** True only when the membership is ACTIVE (INVITED/REVOKED never authorize). */
export function isActiveMembership(
  membership: MembershipContext | null | undefined,
): membership is MembershipContext {
  return membership?.status === "ACTIVE";
}

/** True only when the user is ACTIVE (SUSPENDED/DELETED never authorize). */
export function isActiveUser(
  user: AuthenticatedUser | null | undefined,
): user is AuthenticatedUser {
  return user?.status === "ACTIVE";
}

/** Deny-by-default minimum-rank check. Unknown roles rank as -1 (deny). */
export function hasAtLeastRole(
  membership: MembershipContext | null | undefined,
  minimum: MemberRole,
): boolean {
  if (!isActiveMembership(membership)) {
    return false;
  }
  const granted = ROLE_RANK[membership.role] ?? -1;
  const required = ROLE_RANK[minimum] ?? -1;
  return granted >= required && required > 0;
}

/** The effective role of a membership, or null when it does not authorize. */
export function effectiveRole(membership: MembershipContext | null | undefined): MemberRole | null {
  return isActiveMembership(membership) ? membership.role : null;
}
