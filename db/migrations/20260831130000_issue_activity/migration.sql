-- Durable issue lifecycle activity, protected by the same transaction-local
-- tenant context as the issues table.
CREATE TABLE "issue_activities" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "fromStatus" "IssueStatus",
  "toStatus" "IssueStatus",
  "assignedToId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "issue_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "issue_activities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "issue_activities_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "issue_activities_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "issue_activities_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "issue_activities_organizationId_issueId_createdAt_idx" ON "issue_activities"("organizationId", "issueId", "createdAt");
CREATE INDEX "issue_activities_organizationId_createdAt_idx" ON "issue_activities"("organizationId", "createdAt");

ALTER TABLE "issue_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issue_activities" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_issue_activities" ON "issue_activities"
  FOR SELECT USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_insert_issue_activities" ON "issue_activities"
  FOR INSERT WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_update_issue_activities" ON "issue_activities"
  FOR UPDATE USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_delete_issue_activities" ON "issue_activities"
  FOR DELETE USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
