import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import { DashboardOrganizationProvider, DashboardShell } from "./dashboard-shell";
import { RemediationView } from "./remediation-view";

export async function RemediationDashboardPage() {
  const identity = await getCurrentUser();
  const membership = identity ? (await listCurrentUserMemberships())[0] : undefined;

  if (!identity) {
    return (
      <main className="onboarding-content">
        <h1>Sign in to view automated remediation</h1>
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
        title="AutoFix Remediation & Safeguards"
        description="Safe 8-step automated remediation pipeline with operator authorization controls and verified rollbacks."
      >
        <RemediationView
          key={membership.organizationId}
          organizationId={membership.organizationId}
        />
      </DashboardShell>
    </DashboardOrganizationProvider>
  );
}

