import "server-only";

/**
 * Prisma implementation of the identity repository (Phase 1B-05, amended in
 * 1B-07 for RLS compatibility).
 *
 * 1B-07 change: membership reads now execute inside GUC-scoped transactions
 * (db/tenant.ts). Once the tenant RLS migration is applied, organization_members
 * is protected by FORCE ROW LEVEL SECURITY; the unscoped reads used previously
 * would return zero rows and break authorization. Reads now set:
 * - findMembership: app.org_id + app.user_id (matches the tenant policy and
 *   the documented self-membership SELECT policy).
 * - listMemberships: app.user_id only (self-membership SELECT policy — the
 *   user may enumerate their OWN memberships; other users' rows stay hidden).
 * The users table carries no tenant data and remains under normal ACLs.
 */

import type { AuthenticatedUser, IdentityRepository, MembershipContext } from "@/lib/auth/identity";
import { getPrisma } from "@/db/client";
import { withGucContext } from "@/db/tenant";

export const prismaIdentityRepository: IdentityRepository = {
  async findUserById(userId: string): Promise<AuthenticatedUser | null> {
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, status: true },
    });
    if (user === null) {
      return null;
    }
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
    };
  },

  async findMembership(userId: string, organizationId: string): Promise<MembershipContext | null> {
    return withGucContext({ organizationId, userId }, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
        select: { organizationId: true, role: true, status: true },
      }),
    );
  },

  async listMemberships(userId: string): Promise<readonly MembershipContext[]> {
    return withGucContext({ userId }, (tx) =>
      tx.organizationMember.findMany({
        where: { userId },
        select: { organizationId: true, role: true, status: true },
      }),
    );
  },
};
