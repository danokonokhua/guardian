-- Prisma application role permissions for the monitoring results table.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "monitoring_results" TO guardian_app;
  END IF;
END $$;
