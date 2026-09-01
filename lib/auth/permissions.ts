/**
 * Static RBAC permission model (Phase 1B-07).
 *
 * Authority: the approved Phase 1A §10 permission matrix. Permissions are
 * EXPLICIT per role — never inferred from role rank. Deny-by-default:
 * unknown roles and unknown permission strings never authorize.
 *
 * ADMIN rule (architectural invariant): ADMIN receives every OWNER
 * permission EXCEPT `org:delete`, and may never manage OWNER-level members
 * (that constraint is enforced by the membership service in a later phase;
 * the map itself simply grants `member:manage`, which by documented
 * convention excludes creating/promoting/demoting/deleting OWNERs).
 */

import type { MemberRole } from "@prisma/client";

/** Every permission string Guardian recognizes today (Phase 1A §10). */
export const PERMISSIONS = [
  "org:read",
  "org:update",
  "org:delete",
  "member:read",
  "member:invite",
  "member:manage",
  "audit:read",
  "business:read",
  "business:create",
  "business:update",
  "business:delete",
  "website:read",
  "website:create",
  "website:update",
  "website:delete",
  "website:scan",
  "monitoring:read",
  "monitoring:manage",
  "issue:read",
  "issue:manage",
  "recommendation:read",
  "recommendation:manage",
  "health:read",
  "report:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const OWNER_PERMISSIONS: readonly Permission[] = [
  "org:read",
  "org:update",
  "org:delete",
  "member:read",
  "member:invite",
  "member:manage",
  "audit:read",
  "business:read",
  "business:create",
  "business:update",
  "business:delete",
  "website:read",
  "website:create",
  "website:update",
  "website:delete",
  "website:scan",
  "monitoring:read",
  "monitoring:manage",
  "issue:read",
  "issue:manage",
  "recommendation:read",
  "recommendation:manage",
  "health:read",
  "report:read",
];

/** OWNER minus org:delete (ADMIN invariant). */
const ADMIN_PERMISSIONS: readonly Permission[] = OWNER_PERMISSIONS.filter(
  (permission) => permission !== "org:delete",
);

const MEMBER_PERMISSIONS: readonly Permission[] = [
  "org:read",
  "member:read",
  "business:read",
  "business:create",
  "business:update",
  "business:delete",
  "website:read",
  "website:create",
  "website:update",
  "website:delete",
  "website:scan",
  "monitoring:read",
  "monitoring:manage",
  "issue:read",
  "issue:manage",
  "recommendation:read",
  "recommendation:manage",
  "health:read",
  "report:read",
];

const VIEWER_PERMISSIONS: readonly Permission[] = [
  "org:read",
  "member:read",
  "business:read",
  "website:read",
  "monitoring:read",
  "issue:read",
  "recommendation:read",
  "health:read",
  "report:read",
];

/** Immutable role → permission map. Frozen at module load; do not mutate. */
export const ROLE_PERMISSIONS: Readonly<Record<MemberRole, readonly Permission[]>> = Object.freeze({
  OWNER: Object.freeze(OWNER_PERMISSIONS),
  ADMIN: Object.freeze(ADMIN_PERMISSIONS),
  MEMBER: Object.freeze(MEMBER_PERMISSIONS),
  VIEWER: Object.freeze(VIEWER_PERMISSIONS),
});

/**
 * Deny-by-default permission check. Unknown roles, unknown permission
 * strings, null, and undefined all return false — absence of an explicit
 * grant NEVER authorizes.
 */
export function can(
  role: MemberRole | string | null | undefined,
  permission: Permission | string,
): boolean {
  if (role === null || role === undefined) {
    return false;
  }
  const granted = ROLE_PERMISSIONS[role as MemberRole];
  if (granted === undefined) {
    return false;
  }
  return granted.includes(permission as Permission);
}
