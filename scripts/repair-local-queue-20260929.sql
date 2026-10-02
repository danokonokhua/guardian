-- Incident-specific repair. Requires a secured backup, stopped web/worker,
-- and a successful isolated rehearsal. Not a migration or general deduplicator.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL enable_indexscan = off;
SET LOCAL enable_indexonlyscan = off;
SET LOCAL enable_bitmapscan = off;
DO $$
BEGIN
  IF current_database() NOT IN ('guardian_test', 'guardian_repair_rehearsal') THEN
    RAISE EXCEPTION 'Repair is restricted to the reviewed local databases';
  END IF;
END $$;
-- Lock all queue tables, including job partitions, for before/after evidence.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='guardian_jobs' ORDER BY tablename LOOP
    EXECUTE format('LOCK TABLE guardian_jobs.%I IN ACCESS EXCLUSIVE MODE',t.tablename);
  END LOOP;
END $$;
CREATE TEMP TABLE repair_fingerprints(name text PRIMARY KEY, fingerprint text);
DO $$ DECLARE t record; f text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='guardian_jobs' AND tablename <> 'queue' LOOP
    EXECUTE format('SELECT md5(coalesce(string_agg(h, '''' ORDER BY h), '''')) FROM (SELECT md5(to_jsonb(t)::text) h FROM guardian_jobs.%I t) s',t.tablename) INTO f;
    INSERT INTO repair_fingerprints VALUES(t.tablename,f);
  END LOOP;
END $$;
CREATE TEMP TABLE repair_original_queue AS SELECT * FROM guardian_jobs.queue;
DO $$ BEGIN
  IF (SELECT count(*) FROM guardian_jobs.queue) <> 10 OR
     (SELECT count(DISTINCT name COLLATE "C") FROM guardian_jobs.queue) <> 6 OR
     (SELECT count(*) FROM (SELECT name COLLATE "C" FROM guardian_jobs.queue GROUP BY 1 HAVING count(*)=2) d) <> 4 OR
     EXISTS (SELECT 1 FROM guardian_jobs.queue WHERE name NOT IN
       ('monitor.check','issue.sla_escalation','notification.deliver','notification.external','system.ping','__pgboss__send-it')) OR
     EXISTS (SELECT 1 FROM guardian_jobs.queue WHERE partition OR table_name <> 'job_common' OR dead_letter IS NOT NULL) THEN
    RAISE EXCEPTION 'Queue state differs from the reviewed incident; aborting';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='guardian_jobs.queue'::regclass AND tgenabled <> 'O') THEN
    RAISE EXCEPTION 'Unexpected queue trigger configuration';
  END IF;
END $$;
-- Latest definitions match the current application's monitor and delivery defaults.
CREATE TEMP TABLE repair_keep AS
SELECT DISTINCT ON (name COLLATE "C") ctid AS row_id, name
FROM guardian_jobs.queue
ORDER BY name COLLATE "C", updated_on DESC, created_on DESC, ctid DESC;
-- Suppress delete cascades only on queue, only inside this locked transaction.
-- Jobs/schedules refer to the preserved names, not metadata row identities.
ALTER TABLE guardian_jobs.queue DISABLE TRIGGER ALL;
DELETE FROM guardian_jobs.queue q WHERE NOT EXISTS (SELECT 1 FROM repair_keep k WHERE k.row_id=q.ctid);
REINDEX TABLE guardian_jobs.queue;
ALTER TABLE guardian_jobs.queue ENABLE TRIGGER ALL;
DO $$ DECLARE t record; f text; BEGIN
  IF (SELECT count(*) FROM guardian_jobs.queue) <> 6 THEN RAISE EXCEPTION 'Wrong retained queue count'; END IF;
  IF EXISTS (SELECT name FROM repair_original_queue EXCEPT SELECT name FROM guardian_jobs.queue) THEN
    RAISE EXCEPTION 'A queue name was lost';
  END IF;
  IF EXISTS (SELECT 1 FROM guardian_jobs.job j WHERE NOT EXISTS (SELECT 1 FROM guardian_jobs.queue q WHERE q.name=j.name)) OR
     EXISTS (SELECT 1 FROM guardian_jobs.job j WHERE j.dead_letter IS NOT NULL AND NOT EXISTS (SELECT 1 FROM guardian_jobs.queue q WHERE q.name=j.dead_letter)) OR
     EXISTS (SELECT 1 FROM guardian_jobs.schedule s WHERE NOT EXISTS (SELECT 1 FROM guardian_jobs.queue q WHERE q.name=s.name)) OR
     EXISTS (SELECT 1 FROM guardian_jobs.subscription s WHERE NOT EXISTS (SELECT 1 FROM guardian_jobs.queue q WHERE q.name=s.name)) THEN
    RAISE EXCEPTION 'Orphaned queue reference';
  END IF;
  FOR t IN SELECT * FROM repair_fingerprints LOOP
    EXECUTE format('SELECT md5(coalesce(string_agg(h, '''' ORDER BY h), '''')) FROM (SELECT md5(to_jsonb(t)::text) h FROM guardian_jobs.%I t) s',t.name) INTO f;
    IF f IS DISTINCT FROM t.fingerprint THEN RAISE EXCEPTION 'Dependent queue data changed'; END IF;
  END LOOP;
END $$;
COMMIT;
