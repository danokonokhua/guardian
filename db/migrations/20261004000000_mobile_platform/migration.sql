CREATE TABLE IF NOT EXISTS mobile_push_subscriptions (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  "p256dhKey" TEXT NOT NULL,
  "authKey" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS mobile_push_subscriptions_org_idx ON mobile_push_subscriptions ("organizationId");
CREATE INDEX IF NOT EXISTS mobile_push_subscriptions_user_idx ON mobile_push_subscriptions ("userId");

ALTER TABLE mobile_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_push_subscriptions FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_mobile_push_subscriptions ON mobile_push_subscriptions
    USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON mobile_push_subscriptions TO guardian_app;
  END IF;
END $$;

