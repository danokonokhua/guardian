import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships, requirePermission } from "@/lib/auth/context";
import { createTenantScope } from "@/db/tenant";
import { readOrganizationOverview } from "@/services/organizations/repository";
import {
  DashboardOrganizationProvider,
  DashboardShell,
} from "@/components/dashboard/dashboard-shell";
import { BillingOverview } from "./billing-overview";
export const dynamic = "force-dynamic";
export default async function BillingPage() {
  const identity = await getCurrentUser();
  const membership = identity ? (await listCurrentUserMemberships())[0] : undefined;
  if (!identity)
    return (
      <main className="onboarding-content">
        <h1>Sign in to view your plan</h1>
        <Link href="/login" className="button-primary mt-6">
          Sign in
        </Link>
      </main>
    );
  if (!membership)
    return (
      <main className="onboarding-content">
        <h1>No active organization</h1>
      </main>
    );
  const context = await requirePermission(membership.organizationId, "org:read");
  const organization = await readOrganizationOverview(createTenantScope(context));
  return (
    <DashboardOrganizationProvider
      value={{
        organizationId: membership.organizationId,
        userId: identity.user.userId,
        email: identity.user.email,
        role: membership.role,
      }}
    >
      <DashboardShell
        title="Plans & Billing"
        description="Your organization's plan and subscription information."
      >
        <BillingOverview
          organizationId={membership.organizationId}
          organizationName={organization?.name ?? "Organization unavailable"}
          plan={organization?.plan ?? null}
        />
      </DashboardShell>
    </DashboardOrganizationProvider>
  );
}
