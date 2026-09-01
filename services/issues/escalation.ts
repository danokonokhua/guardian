import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { enqueueNotification, type NotificationEvent } from "@/lib/notifications";
import { readOrganizationSlaPolicy } from "@/services/organizations/settings";

export interface SlaEscalationResult {
  checkedIssues: number;
  breachedIssues: number;
  notificationsQueued: number;
}

export async function enqueueSlaEscalations(
  scope: TenantScope,
  enqueue: (event: NotificationEvent) => Promise<string | null> = (event) =>
    enqueueNotification(event),
): Promise<SlaEscalationResult> {
  const policy = await readOrganizationSlaPolicy(scope);
  const data = await withTenantTransaction(scope, async (tx) => {
    const [issues, members] = await Promise.all([
      tx.issue.findMany({
        where: { organizationId: scope.organizationId, status: { notIn: ["RESOLVED", "IGNORED"] } },
        orderBy: { firstSeenAt: "asc" },
        take: 1000,
        select: {
          id: true,
          title: true,
          severity: true,
          firstSeenAt: true,
          activities: {
            where: { action: { in: ["ACKNOWLEDGED", "RESOLVED"] } },
            orderBy: { createdAt: "asc" },
            select: { action: true, createdAt: true },
          },
        },
      }),
      tx.organizationMember.findMany({
        where: {
          organizationId: scope.organizationId,
          status: "ACTIVE",
          role: { in: ["OWNER", "ADMIN"] },
        },
        select: { userId: true },
      }),
    ]);
    return { issues, members };
  });
  const now = Date.now();
  const breached = data.issues.filter((issue) => {
    const acknowledged = issue.activities.find((activity) => activity.action === "ACKNOWLEDGED");
    const ageMinutes = (now - issue.firstSeenAt.getTime()) / 60_000;
    const ackBreach = !acknowledged && ageMinutes > policy.acknowledgeMinutes;
    const resolveBreach = ageMinutes > policy.resolveMinutes;
    return ackBreach || resolveBreach;
  });
  let notificationsQueued = 0;
  for (const issue of breached) {
    const ageMinutes = Math.floor((now - issue.firstSeenAt.getTime()) / 60_000);
    const eventBase = {
      organizationId: scope.organizationId,
      issueId: issue.id,
      title: `SLA breach: ${issue.title}`,
      body: `${issue.severity} issue has been open for ${ageMinutes} minutes and exceeded an organization SLA target.`,
      channel: "IN_APP" as const,
    };
    for (const member of data.members) {
      const result = await enqueue({ ...eventBase, recipientUserId: member.userId });
      if (result !== null) notificationsQueued += 1;
    }
  }
  return {
    checkedIssues: data.issues.length,
    breachedIssues: breached.length,
    notificationsQueued,
  };
}
