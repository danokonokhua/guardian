-- Notification tables were created after the initial runtime-role grants.
-- Grant only table DML; existing ENABLE/FORCE RLS policies remain unchanged.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notification_preferences TO guardian_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.in_app_notifications TO guardian_app;
  END IF;
END
$$;
