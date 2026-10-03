DO $$ BEGIN
  CREATE TYPE "WordpressConnectionStatus" AS ENUM ('CONNECTED', 'SYNCING', 'ERROR', 'DISCONNECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS wordpress_connections (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "websiteId" TEXT NOT NULL UNIQUE REFERENCES websites(id) ON DELETE CASCADE,
  "siteUrl" TEXT NOT NULL,
  "tokenEncrypted" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  status "WordpressConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
  "wpVersion" TEXT,
  "phpVersion" TEXT,
  "serverSoftware" TEXT,
  "debugMode" BOOLEAN NOT NULL DEFAULT false,
  "httpsEnforced" BOOLEAN NOT NULL DEFAULT true,
  "updatesAvailable" JSONB,
  plugins JSONB,
  themes JSONB,
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "isSandbox" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS wordpress_connections_org_idx ON wordpress_connections ("organizationId");
CREATE INDEX IF NOT EXISTS wordpress_connections_token_prefix_idx ON wordpress_connections ("tokenPrefix");

ALTER TABLE wordpress_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordpress_connections FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_wordpress_connections ON wordpress_connections
    USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON wordpress_connections TO guardian_app;
  END IF;
END $$;
