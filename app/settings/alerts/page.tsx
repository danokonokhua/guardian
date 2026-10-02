import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import {
  DashboardOrganizationProvider,
  DashboardShell,
} from "@/components/dashboard/dashboard-shell";
import { AlertSettings } from "./alert-settings";
export const dynamic = "force-dynamic";
export default async function AlertsPage() {
  const identity = await getCurrentUser();
  const membership = identity ? (await listCurrentUserMemberships())[0] : undefined;
  if (!identity)
    return (
      <main className="onboarding-content">
        <h1>Sign in to manage alerts</h1>
        <Link href="/login" className="button-primary">
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
        title="Notifications & SLA Controls"
        description="Choose your issue notification channels and set your organization's response targets."
      >
        <AlertSettings
          key={membership.organizationId}
          organizationId={membership.organizationId}
          canManage={can(membership.role, "issue:manage")}
          canManageDestinations={can(membership.role, "org:update")}
        />
      </DashboardShell>
    </DashboardOrganizationProvider>
  );
}
