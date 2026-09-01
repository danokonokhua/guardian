import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";

export interface OrganizationMemberRecord {
  userId: string;
  email: string;
  name: string | null;
  role: string;
}

export function listActiveOrganizationMembers(
  scope: TenantScope,
): Promise<OrganizationMemberRecord[]> {
  return withTenantTransaction(scope, async (tx) => {
    const rows = await tx.organizationMember.findMany({
      where: { organizationId: scope.organizationId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { userId: true, role: true, user: { select: { email: true, name: true } } },
    });
    return rows.map((row) => ({
      userId: row.userId,
      email: row.user.email,
      name: row.user.name,
      role: row.role,
    }));
  });
}
