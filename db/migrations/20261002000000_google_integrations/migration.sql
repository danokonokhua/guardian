DO $$ BEGIN
  CREATE TYPE "GoogleProvider" AS ENUM ('GA4', 'SEARCH_CONSOLE', 'BUSINESS_PROFILE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "GoogleIntegrationStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH', 'DISCONNECTED', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS google_integrations (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "websiteId" TEXT REFERENCES websites(id) ON DELETE CASCADE,
  provider "GoogleProvider" NOT NULL,
  status "GoogleIntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
  "accountEmail" TEXT,
  "propertyId" TEXT,
  "propertyName" TEXT,
  "encryptedCredentials" TEXT NOT NULL,
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "syncSummary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS google_integrations_org_prov_prop ON google_integrations ("organizationId", provider, "propertyId");
CREATE INDEX IF NOT EXISTS google_integrations_org_status ON google_integrations ("organizationId", status);

ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_integrations FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_google_integrations ON google_integrations
    USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON google_integrations TO guardian_app;
  END IF;
END $$;

