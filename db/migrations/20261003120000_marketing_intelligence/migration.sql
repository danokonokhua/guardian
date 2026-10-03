CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "websiteId" TEXT REFERENCES websites(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  "externalCampaignId" TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  currency TEXT NOT NULL DEFAULT 'USD',
  "budgetDailyCents" INTEGER,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_campaigns_org_ch_ext ON marketing_campaigns ("organizationId", channel, "externalCampaignId");
CREATE INDEX IF NOT EXISTS marketing_campaigns_org_idx ON marketing_campaigns ("organizationId");
CREATE INDEX IF NOT EXISTS marketing_campaigns_org_ch_idx ON marketing_campaigns ("organizationId", channel);
CREATE INDEX IF NOT EXISTS marketing_campaigns_org_status_idx ON marketing_campaigns ("organizationId", status);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_marketing_campaigns ON marketing_campaigns
    USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_campaigns TO guardian_app;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS marketing_metric_snapshots (
  id TEXT PRIMARY KEY,
  "campaignId" TEXT NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  "spendCents" INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  "revenueCents" INTEGER DEFAULT 0,
  "ctrPct" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "cpcCents" INTEGER NOT NULL DEFAULT 0,
  "costPerLeadCents" INTEGER NOT NULL DEFAULT 0,
  roas DOUBLE PRECISION DEFAULT 0.0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS marketing_metric_snapshots_camp_start_idx ON marketing_metric_snapshots ("campaignId", "periodStart");
CREATE INDEX IF NOT EXISTS marketing_metric_snapshots_org_start_idx ON marketing_metric_snapshots ("organizationId", "periodStart");

ALTER TABLE marketing_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_metric_snapshots FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_marketing_metric_snapshots ON marketing_metric_snapshots
    USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_metric_snapshots TO guardian_app;
  END IF;
END $$;

