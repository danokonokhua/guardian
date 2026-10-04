import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import { DashboardOrganizationProvider, DashboardShell } from "./dashboard-shell";
import { CooView } from "./coo-view";

export async function CooDashboardPage() {
  const identity = await getCurrentUser();
  const membership = identity ? (await listCurrentUserMemberships())[0] : undefined;

  if (!identity) {
    return (
      <main className="onboarding-content">
        <h1>Sign in to view AI COO Platform</h1>
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
        title="AI COO Executive Operations Hub"
        description="Autonomous Chief Operating Officer synthesizing cross-domain telemetry into executive revenue roadmaps and 1-click strategic directives."
      >
        <CooView
          key={membership.organizationId}
          organizationId={membership.organizationId}
        />
      </DashboardShell>
    </DashboardOrganizationProvider>
  );
}
