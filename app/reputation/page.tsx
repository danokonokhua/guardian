import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import { DashboardOrganizationProvider, DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ReputationDashboard } from "@/components/dashboard/reputation-dashboard";

export const dynamic = "force-dynamic";

export default async function ReputationPage() {
  const identity = await getCurrentUser();
  const membership = identity ? (await listCurrentUserMemberships())[0] : undefined;

  if (!identity) {
    return (
      <main className="onboarding-content">
        <h1>Sign in to view reputation intelligence</h1>
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
        title="Reputation & Review Intelligence"
        description="Monitor customer ratings, sentiment velocity, and AI-suggested review responses to protect brand trust and local search ranking."
      >
        <ReputationDashboard
          key={membership.organizationId}
          organizationId={membership.organizationId}
        />
      </DashboardShell>
    </DashboardOrganizationProvider>
  );
}
