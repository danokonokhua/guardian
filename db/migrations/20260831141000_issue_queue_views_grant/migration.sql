DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "issue_queue_views" TO guardian_app;
  END IF;
END $$;
