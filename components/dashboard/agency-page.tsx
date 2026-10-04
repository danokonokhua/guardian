import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import { DashboardOrganizationProvider, DashboardShell } from "./dashboard-shell";
import { AgencyView } from "./agency-view";

export async function AgencyDashboardPage() {
  const identity = await getCurrentUser();
  const membership = identity ? (await listCurrentUserMemberships())[0] : undefined;

  if (!identity) {
    return (
      <main className="onboarding-content">
        <h1>Sign in to view agency command center</h1>
        <Link href="/login" className="button-primary mt-6">
          Sign in
        </Link>
      </main>
    );
  }

  if (!membership) {
    return (
      <main className="onboarding-content">
        <h1>No active organization</h1>
      </main>
    );
  }

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
        title="Agency Command Center"
        description="Multi-client website monitoring, portfolio health matrix, retainer revenue management, and white-label branding."
      >
        <AgencyView key={membership.organizationId} organizationId={membership.organizationId} />
      </DashboardShell>
    </DashboardOrganizationProvider>
  );
}
