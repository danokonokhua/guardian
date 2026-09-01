import { NotificationsPanel } from "@/app/notifications-panel";
import { MonitoringPanel } from "@/app/monitoring-panel";
import { HealthPanel } from "@/app/health-panel";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import {
  DashboardOrganizationProvider,
  DashboardShell,
} from "@/components/dashboard/dashboard-shell";

export const dynamic = "force-dynamic";

/**
 * Authenticated dashboard entrypoint. The organization is selected only from
 * active memberships returned by the identity boundary, never from a query
 * parameter or hard-coded tenant id.
 */
export default async function DashboardPage() {
  const identity = await getCurrentUser();
  if (identity === null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/60 p-10 text-center">
          <h1 className="text-2xl font-semibold">Sign in to Guardian</h1>
          <p className="mt-3 text-sm text-neutral-400">
            An authenticated session is required to access the dashboard.
          </p>
        </section>
      </main>
    );
  }

  const memberships = await listCurrentUserMemberships();
  const membership = memberships[0];
  if (membership === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/60 p-10 text-center">
          <h1 className="text-2xl font-semibold">No active organization</h1>
          <p className="mt-3 text-sm text-neutral-400">
            Your account does not currently have an active Guardian organization membership.
          </p>
        </section>
      </main>
    );
  }

  const organization = {
    organizationId: membership.organizationId,
    userId: identity.user.userId,
    role: membership.role,
    email: identity.user.email,
  };

  return (
    <DashboardOrganizationProvider value={organization}>
      <DashboardShell>
        <section id="health" aria-labelledby="health-heading">
          <div className="mb-4">
            <h2 id="health-heading" className="text-xl font-semibold">
              Health and incidents
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              Recent outcomes, response times, active issues, and recovery state.
            </p>
          </div>
          <HealthPanel
            organizationId={organization.organizationId}
            userId={organization.userId}
            canManageIssues={membership.role !== "VIEWER"}
          />
        </section>
        <section id="notifications" aria-labelledby="notifications-heading">
          <div className="mb-4">
            <h2 id="notifications-heading" className="text-xl font-semibold">
              Notifications
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              Recent operational events for your organization.
            </p>
          </div>
          <NotificationsPanel organizationId={organization.organizationId} />
        </section>
        <section id="monitoring" aria-labelledby="monitoring-heading">
          <div className="mb-4">
            <h2 id="monitoring-heading" className="text-xl font-semibold">
              Monitoring
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              Health checks configured for your organization’s websites.
            </p>
          </div>
          <MonitoringPanel organizationId={organization.organizationId} />
        </section>
      </DashboardShell>
    </DashboardOrganizationProvider>
  );
}
