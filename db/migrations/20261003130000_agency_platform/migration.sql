CREATE TABLE IF NOT EXISTS agency_clients (
  id TEXT PRIMARY KEY,
  "agencyOrganizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "clientOrganizationId" TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  "clientName" TEXT NOT NULL,
  "clientDomain" TEXT NOT NULL,
  "contactEmail" TEXT,
  "contactName" TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  "monthlyRetainerCents" INTEGER DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  "healthScore" INTEGER DEFAULT 85,
  "lastScannedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS agency_clients_agency_domain_idx ON agency_clients ("agencyOrganizationId", "clientDomain");
CREATE INDEX IF NOT EXISTS agency_clients_agency_idx ON agency_clients ("agencyOrganizationId");
CREATE INDEX IF NOT EXISTS agency_clients_agency_status_idx ON agency_clients ("agencyOrganizationId", status);

ALTER TABLE agency_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_clients FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_agency_clients ON agency_clients
    USING ("agencyOrganizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("agencyOrganizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON agency_clients TO guardian_app;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS agency_brandings (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  "companyName" TEXT NOT NULL,
  "logoUrl" TEXT,
  "brandPrimaryColor" TEXT DEFAULT '#06b6d4',
  "brandAccentColor" TEXT DEFAULT '#8b5cf6',
  "customDomain" TEXT,
  "portalTitle" TEXT,
  "supportEmail" TEXT,
  "footerText" TEXT,
  "isWhiteLabelActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE agency_brandings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_brandings FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_agency_brandings ON agency_brandings
    USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON agency_brandings TO guardian_app;
  END IF;
END $$;

