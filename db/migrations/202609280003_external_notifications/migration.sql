CREATE TABLE notification_destinations (
  id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, channel TEXT NOT NULL CHECK (channel IN ('SLACK','TEAMS','DISCORD','WEBHOOK')),
  host TEXT NOT NULL, credentials TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE (id, "organizationId")
);
CREATE INDEX notification_destinations_org_enabled ON notification_destinations ("organizationId", enabled);
CREATE TABLE external_deliveries (
  id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "destinationId" TEXT NOT NULL, "issueId" TEXT, "dedupKey" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT, "httpStatus" INTEGER, "leaseId" TEXT, "leaseUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "deliveredAt" TIMESTAMP(3),
  FOREIGN KEY ("destinationId", "organizationId") REFERENCES notification_destinations(id, "organizationId") ON DELETE CASCADE,
  UNIQUE ("destinationId", "dedupKey")
);
CREATE INDEX external_deliveries_org_created ON external_deliveries ("organizationId", "createdAt");
ALTER TABLE notification_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_destinations FORCE ROW LEVEL SECURITY;
ALTER TABLE external_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_destinations ON notification_destinations
 USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
 WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
CREATE POLICY tenant_external_deliveries ON external_deliveries
 USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
 WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
  GRANT SELECT, INSERT, UPDATE, DELETE ON notification_destinations, external_deliveries TO guardian_app;
 END IF;
END $$;
