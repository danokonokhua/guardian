import type { OrganizationContext } from "@/lib/auth/context";

/**
 * Organization application-service boundary (Phase 1B-06 demonstration).
 *
 * Deliberately thin: future Guardian organization features live here, behind
 * the API layer, consuming the authorized tenant context — never HTTP
 * concerns. This function only shapes the read-only context snapshot used by
 * the architectural test endpoint; it adds no business capability.
 */

export interface OrganizationContextSnapshot {
  organization: { id: string };
  member: { userId: string; email: string; role: string };
}

export function organizationContextSnapshot(
  context: OrganizationContext,
): OrganizationContextSnapshot {
  return {
    organization: { id: context.organizationId },
    member: {
      userId: context.user.userId,
      email: context.user.email,
      role: context.membership.role,
    },
  };
}
