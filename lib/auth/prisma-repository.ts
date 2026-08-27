import "server-only";

/**
 * Prisma implementation of the identity repository (Phase 1B-05).
 *
 * Server-only (transitively guarded with the db client's marker). Reads the
 * narrow field projections defined by lib/auth/identity.ts through the
 * existing database boundary (db/client.ts) — no second ORM, no raw SQL.
 */

import type { AuthenticatedUser, IdentityRepository, MembershipContext } from "@/lib/auth/identity";
import { getPrisma } from "@/db/client";

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
    const membership = await getPrisma().organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { organizationId: true, role: true, status: true },
    });
    return membership;
  },

  async listMemberships(userId: string): Promise<readonly MembershipContext[]> {
    return getPrisma().organizationMember.findMany({
      where: { userId },
      select: { organizationId: true, role: true, status: true },
    });
  },
};
