ALTER TYPE "MonitorType" ADD VALUE IF NOT EXISTS 'DOMAIN_EXPIRY';
CREATE TABLE "domain_expiry_alerts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "domain" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "thresholdDays" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "domain_expiry_alert_cycle"
  ON "domain_expiry_alerts" ("organizationId", "domain", "expiresAt", "thresholdDays");
ALTER TABLE "domain_expiry_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "domain_expiry_alerts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_domain_expiry_alerts" ON "domain_expiry_alerts"
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "domain_expiry_alerts" TO guardian_app;
  END IF;
END $$;
