CREATE TABLE IF NOT EXISTS remediation_actions (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "issueId" TEXT REFERENCES issues(id) ON DELETE SET NULL,
  "websiteId" TEXT REFERENCES websites(id) ON DELETE SET NULL,
  "actionType" TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
  problem TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "autoExecutable" BOOLEAN NOT NULL DEFAULT false,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "rolledBackAt" TIMESTAMP(3),
  "executionResult" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "verificationResult" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "rollbackPlan" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "auditLog" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS remediation_actions_org_idx ON remediation_actions ("organizationId");
CREATE INDEX IF NOT EXISTS remediation_actions_org_status_idx ON remediation_actions ("organizationId", status);
CREATE INDEX IF NOT EXISTS remediation_actions_issue_idx ON remediation_actions ("issueId");

ALTER TABLE remediation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_actions FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_remediation_actions ON remediation_actions
    USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON remediation_actions TO guardian_app;
  END IF;
END $$;

