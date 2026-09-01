-- Durable monitor observations and forced tenant isolation.

CREATE TYPE "MonitorResultStatus" AS ENUM ('UP', 'DOWN', 'ERROR');

ALTER TABLE "websites" ADD COLUMN "verificationAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "monitoring_results" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "monitorId" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "status" "MonitorResultStatus" NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responseTimeMs" INTEGER,
  "httpStatusCode" INTEGER,
  "errorMessage" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monitoring_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monitoring_results_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "monitoring_results_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "monitoring_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "monitoring_results_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "monitoring_results_organizationId_monitorId_checkedAt_idx" ON "monitoring_results"("organizationId", "monitorId", "checkedAt");
CREATE INDEX "monitoring_results_websiteId_checkedAt_idx" ON "monitoring_results"("websiteId", "checkedAt");

ALTER TABLE "monitoring_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monitoring_results" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_monitoring_results" ON "monitoring_results"
  FOR SELECT USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_insert_monitoring_results" ON "monitoring_results"
  FOR INSERT WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_update_monitoring_results" ON "monitoring_results"
  FOR UPDATE USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_delete_monitoring_results" ON "monitoring_results"
  FOR DELETE USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
