CREATE TABLE status_pages (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 slug TEXT NOT NULL UNIQUE, document JSONB NOT NULL, published BOOLEAN NOT NULL DEFAULT false,
 version INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 UNIQUE(id, "organizationId")
);
CREATE INDEX status_pages_org_created ON status_pages ("organizationId", "createdAt");
CREATE TABLE public_status_pages (
 "pageId" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 slug TEXT NOT NULL UNIQUE, document JSONB NOT NULL,
 FOREIGN KEY ("pageId", "organizationId") REFERENCES status_pages(id, "organizationId") ON DELETE CASCADE,
 UNIQUE ("pageId", "organizationId")
);
CREATE TABLE status_page_audits (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 "pageId" TEXT NOT NULL, "actorId" TEXT NOT NULL, action TEXT NOT NULL, version INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("pageId", "organizationId") REFERENCES status_pages(id, "organizationId") ON DELETE CASCADE
);
CREATE INDEX status_page_audits_org_page_created ON status_page_audits ("organizationId", "pageId", "createdAt");
ALTER TABLE external_deliveries ADD COLUMN "statusMessage" JSONB;
ALTER TABLE status_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_pages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_status_pages ON status_pages
 USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
 WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
ALTER TABLE public_status_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_status_pages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_public_status_pages ON public_status_pages
 USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
 WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
ALTER TABLE status_page_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_page_audits FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_status_page_audits ON status_page_audits
 USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
 WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
-- Public reads can see only the separately approved snapshot for one exact slug.
CREATE POLICY published_snapshot_read ON public_status_pages FOR SELECT
 USING (slug = NULLIF(current_setting('app.status_slug', true), ''));
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
 GRANT SELECT, INSERT, UPDATE, DELETE ON status_pages, public_status_pages, status_page_audits TO guardian_app;
 END IF;
END $$;
