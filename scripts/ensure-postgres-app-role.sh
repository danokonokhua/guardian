#!/bin/sh
set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_APP_USER:?POSTGRES_APP_USER is required}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"

export PGPASSWORD="$POSTGRES_PASSWORD"

psql --host postgres --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=app_user="$POSTGRES_APP_USER" \
  --set=app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
SELECT format($guardian_sql$
DO $do$
DECLARE
  app_user text := %L;
  app_password text := %L;
BEGIN
  IF app_user !~ '^[a-z_][a-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'POSTGRES_APP_USER must contain only lowercase letters, numbers, and underscores';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_user) THEN
    EXECUTE format('CREATE ROLE %%I LOGIN PASSWORD %%L', app_user, app_password);
  ELSE
    EXECUTE format('ALTER ROLE %%I LOGIN PASSWORD %%L', app_user, app_password);
  END IF;

  EXECUTE format('ALTER ROLE %%I NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS', app_user);
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS guardian_jobs AUTHORIZATION %%I', current_user);
  EXECUTE format('GRANT CONNECT ON DATABASE %%I TO %%I', current_database(), app_user);
  EXECUTE format('GRANT USAGE ON SCHEMA public, guardian_jobs TO %%I', app_user);
  EXECUTE format('GRANT CREATE ON SCHEMA guardian_jobs TO %%I', app_user);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public, guardian_jobs TO %%I', app_user);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public, guardian_jobs TO %%I', app_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %%I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %%I', current_user, app_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %%I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %%I', current_user, app_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %%I IN SCHEMA guardian_jobs GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %%I', current_user, app_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %%I IN SCHEMA guardian_jobs GRANT USAGE, SELECT ON SEQUENCES TO %%I', current_user, app_user);
END
$do$;
$guardian_sql$, :'app_user', :'app_password') \gexec
SQL
