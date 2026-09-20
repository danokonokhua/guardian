-- Add the separately selectable Basic Security monitor type.
-- Security checks are intentionally distinct from SSL certificate checks.
ALTER TYPE "MonitorType" ADD VALUE IF NOT EXISTS 'SECURITY';
