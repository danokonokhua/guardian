-- The score tables may already exist when this migration is applied.  Ensure
-- the least-privilege runtime role can use them without requiring a superuser.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "health_scores" TO guardian_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "health_score_components" TO guardian_app;
  END IF;
END
$$;
