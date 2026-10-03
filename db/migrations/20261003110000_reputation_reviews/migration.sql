CREATE TABLE IF NOT EXISTS business_reviews (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "websiteId" TEXT REFERENCES websites(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'GOOGLE_BUSINESS',
  "externalId" TEXT,
  "authorName" TEXT NOT NULL,
  "authorAvatarUrl" TEXT,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  "sentimentScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "sentimentKeywords" JSONB,
  "hasReply" BOOLEAN NOT NULL DEFAULT false,
  "replyText" TEXT,
  "aiSuggestedReply" TEXT,
  "aiSuggestionStatus" TEXT,
  "reviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS business_reviews_org_src_ext ON business_reviews ("organizationId", source, "externalId");
CREATE INDEX IF NOT EXISTS business_reviews_org_idx ON business_reviews ("organizationId");
CREATE INDEX IF NOT EXISTS business_reviews_org_src_idx ON business_reviews ("organizationId", source);
CREATE INDEX IF NOT EXISTS business_reviews_org_sent_idx ON business_reviews ("organizationId", sentiment);
CREATE INDEX IF NOT EXISTS business_reviews_org_reply_idx ON business_reviews ("organizationId", "hasReply");

ALTER TABLE business_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_reviews FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_business_reviews ON business_reviews
    USING ("organizationId" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), ''));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON business_reviews TO guardian_app;
  END IF;
END $$;
