# Local backup restoration drill

Run from the repository with Docker access:

```powershell
node scripts/verify-backup-restore.cjs guardian-postgres-test guardian_test
```

The database name is required: the container's default database may not be the application database. The script reads a custom-format logical backup into memory (128 MiB process-output limit), restores into a uniquely named PostgreSQL 16 container with no network or published ports and tmpfs database storage, and removes that container afterward. No running application database is modified. The local PostgreSQL 16 image must be available. This is a small local recovery drill, not a production backup service.

A successful drill requires atomic restoration, completed migrations, public tables, RLS policies and readable public tables. Owner/grants are excluded and only the runtime role stub is created, so this does not verify restored application permissions, login, offsite storage, encryption-key recovery or recovery objectives. Production restoration must separately provision roles/grants and preserve the notification encryption key securely.

## Initial 29 September 2026 result: blocked

Operator: Codex, local development environment. Source: `guardian-postgres-test`, explicitly selected database `guardian_test`.

- Full logical restore failed creating `guardian_jobs.queue_pkey`.
- Read-only source aggregate checks found 10 queue rows but 6 distinct names: four duplicate-key groups with two rows each.
- PostgreSQL reports the source primary-key index as valid and ready despite these duplicated values. The root cause has not been established.
- Temporary restoration containers were removed. Source data, indexes and jobs were not modified. No notifications were sent.

The earlier attempt against the container-default database failed because it lacked Guardian's schema; this is separate from the confirmed application-database failure.

## Repair and repeat verification: passed locally

On 29 September 2026 the user authorized a controlled queue repair. The local web and worker containers were stopped and a pre-repair custom-format archive was saved with private permissions at `/tmp/guardian-before-queue-repair-20260929.dump` inside `guardian-postgres-test`. This archive contains sensitive application data and the original inconsistency; it is recovery evidence, not a clean restore point or offsite backup. It was not committed to Git.

The incident-specific [SQL](../scripts/repair-local-queue-20260929.sql) was rehearsed against that archive in an isolated PostgreSQL container. Pre-data/data sections were loaded, the repair applied, and every post-data constraint/index successfully created. The same transaction then repaired the source:

- Retained the newest definition for each of the six queue names. The monitor queue's 2 retries/5-second delay/60-second expiry and email delivery queue's 3 retries/10-second delay/300-second expiry match current code.
- Removed only four superseded queue metadata rows. Job, schedule, subscription, dispatch and other queue tables were fingerprinted before and after under locks; all fingerprints were unchanged. All 1,392 existing jobs were preserved (994 completed, 398 failed; none pending at the pre-repair check).
- Temporarily suppressed queue delete triggers inside the transaction to prevent cascading deletion of references to retained names, rebuilt queue indexes, restored triggers and verified reference integrity before commit. Any failed assertion would roll back the transaction.
- PostgreSQL `amcheck` parent/heap verification passed for the repaired primary-key index. Its temporary extension creation was rolled back.

A **fresh full backup restored successfully at 2026-09-29 02:45:53 UTC**: 25 public tables, 23 completed migrations, 19 RLS tables, 54 policies and all public tables readable. Temporary containers were removed. The restored constraints/indexes passed; owner/grants and application-level access remain outside this drill.

The web and worker were restarted. All five `beta:check` checks passed at 02:46:34 UTC. A newly enqueued internal `system.ping` was completed by the running worker. No test notifications were sent. The initial corruption's root cause remains undetermined; do not claim that an OS/collation change has been proven. Monitor for recurrence and rerun recovery drills after database/image upgrades.

The repair SQL is guarded for this incident's exact local database names and 10-row/6-name shape; it intentionally refuses to rerun on the repaired state. It is not an automated migration or a general-purpose data cleanup command.

## Production recovery follow-up

Local logical recovery is verified. Public beta readiness still requires target-environment backup storage, retention, permissions, encryption-key recovery, operational ownership and recovery objectives. Do not blindly delete duplicate rows, truncate the queue or rebuild its schema if a future drill fails. A repair to this local database does not establish production recovery readiness or real notification delivery.

Reference: PostgreSQL documents [REINDEX](https://www.postgresql.org/docs/16/sql-reindex.html) as a recovery method for corrupted indexes; actual duplicate rows must be resolved before a unique index can be rebuilt successfully.
