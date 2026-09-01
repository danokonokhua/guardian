CREATE TABLE "issue_queue_views" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "issue_queue_views_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "issue_queue_views_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "issue_queue_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "issue_queue_views_organizationId_userId_name_key" ON "issue_queue_views"("organizationId", "userId", "name");
CREATE INDEX "issue_queue_views_organizationId_userId_idx" ON "issue_queue_views"("organizationId", "userId");

ALTER TABLE "issue_queue_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issue_queue_views" FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_select_issue_queue_views" ON "issue_queue_views"
  FOR SELECT USING (
    "organizationId" = NULLIF(current_setting('app.org_id', true), '')::text
    AND "userId" = NULLIF(current_setting('app.user_id', true), '')::text
  );
CREATE POLICY "user_insert_issue_queue_views" ON "issue_queue_views"
  FOR INSERT WITH CHECK (
    "organizationId" = NULLIF(current_setting('app.org_id', true), '')::text
    AND "userId" = NULLIF(current_setting('app.user_id', true), '')::text
  );
CREATE POLICY "user_update_issue_queue_views" ON "issue_queue_views"
  FOR UPDATE USING (
    "organizationId" = NULLIF(current_setting('app.org_id', true), '')::text
    AND "userId" = NULLIF(current_setting('app.user_id', true), '')::text
  ) WITH CHECK (
    "organizationId" = NULLIF(current_setting('app.org_id', true), '')::text
    AND "userId" = NULLIF(current_setting('app.user_id', true), '')::text
  );
CREATE POLICY "user_delete_issue_queue_views" ON "issue_queue_views"
  FOR DELETE USING (
    "organizationId" = NULLIF(current_setting('app.org_id', true), '')::text
    AND "userId" = NULLIF(current_setting('app.user_id', true), '')::text
  );
