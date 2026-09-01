import "server-only";

/**
 * Tenant-scoped repository pattern (Phase 1B-07 architectural proof).
 *
 * Demonstrates the ONLY sanctioned way future services read tenant-owned
 * data: an authorized TenantScope (from lib/auth/context.ts via
 * createTenantScope) executed inside withTenantTransaction, where PostgreSQL
 * RLS filters rows by the transaction-local GUC. Not a product feature.
 */

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";

export interface OrganizationOverview {
  readonly id: string;
  readonly name: string;
  readonly plan: string;
  readonly memberCount: number;
}

/**
 * Reads one organization plus its member count, strictly inside the tenant
 * transaction. Under RLS, the organization row is visible only when
 * app.org_id matches (and memberCount counts only same-tenant rows).
 */
export function readOrganizationOverview(scope: TenantScope): Promise<OrganizationOverview | null> {
  return withTenantTransaction(scope, async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: scope.organizationId },
      select: { id: true, name: true, plan: true, _count: { select: { members: true } } },
    });
    if (organization === null) {
      return null;
    }
    return {
      id: organization.id,
      name: organization.name,
      plan: organization.plan,
      memberCount: organization._count.members,
    };
  });
}
