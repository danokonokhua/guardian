CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "websiteId" TEXT REFERENCES websites(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS competitors_org_domain ON competitors ("organizationId", domain);
CREATE INDEX IF NOT EXISTS competitors_org_idx ON competitors ("organizationId");
CREATE INDEX IF NOT EXISTS competitors_org_status_idx ON competitors ("organizationId", status);

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_competitors ON competitors
    USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON competitors TO guardian_app;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS competitor_snapshots (
  id TEXT PRIMARY KEY,
  "competitorId" TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "httpStatus" INTEGER,
  "responseTimeMs" INTEGER,
  "pageTitle" TEXT,
  "metaDescription" TEXT,
  h1 TEXT,
  "detectedOffer" TEXT,
  "seoScore" INTEGER DEFAULT 70,
  "contentHash" TEXT,
  "hasChanges" BOOLEAN NOT NULL DEFAULT false,
  "changeSummary" TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS competitor_snapshots_comp_date_idx ON competitor_snapshots ("competitorId", "snapshotDate");
CREATE INDEX IF NOT EXISTS competitor_snapshots_org_date_idx ON competitor_snapshots ("organizationId", "snapshotDate");

ALTER TABLE competitor_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_snapshots FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_competitor_snapshots ON competitor_snapshots
    USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON competitor_snapshots TO guardian_app;
  END IF;
END $$;

