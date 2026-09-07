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

-- The disposable integration database uses a dedicated role. VPS deployments
-- run migrations as the configured application owner and must never create a
-- password-bearing role or assume a database name.
DO $$
BEGIN
  IF current_database() = 'guardian_test' THEN
    BEGIN
      CREATE ROLE guardian_app LOGIN PASSWORD 'postgres';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO guardian_app', current_database());
    GRANT USAGE ON SCHEMA public, guardian_jobs TO guardian_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public, guardian_jobs TO guardian_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public, guardian_jobs TO guardian_app;
  END IF;
END $$;
