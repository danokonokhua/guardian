-- Guardian job foundation (Phase 1B-09)
--
-- pg-boss owns the tables, functions, enums, indexes and future schema
-- migrations inside this dedicated schema. This Prisma migration establishes
-- the namespace explicitly so the database has a stable, non-tenant-owned
-- home for system jobs. pg-boss `start()` creates/upgrades its own objects.
--
-- This schema is intentionally NOT part of the tenant RLS model: system jobs
-- are infrastructure records, not tenant-owned application data.
-- pg-boss requires pgcrypto for UUID generation in its storage schema.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS "guardian_jobs";

-- Non-superuser role used by integration tests and application connections.
DO $$ BEGIN
  CREATE ROLE guardian_app LOGIN PASSWORD 'postgres';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT CONNECT ON DATABASE guardian_test TO guardian_app;
GRANT USAGE ON SCHEMA public, guardian_jobs TO guardian_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public, guardian_jobs TO guardian_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public, guardian_jobs TO guardian_app;
