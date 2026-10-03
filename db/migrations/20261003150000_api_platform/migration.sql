CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[],
  "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
  "lastUsedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys ("keyHash");
CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys ("organizationId");
CREATE INDEX IF NOT EXISTS api_keys_org_revoked_idx ON api_keys ("organizationId", "revokedAt");

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_api_keys ON api_keys
    USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO guardian_app;
  END IF;
END $$;

