# Containerized Guardian

The repository ships a self-contained Docker Compose deployment:

- `postgres` — PostgreSQL 16 with a named persistent volume.
- `migrate` — applies Prisma migrations once and exits.
- `bootstrap` — creates the initial local owner account and organization.
- `web` — serves the Next.js dashboard on port 3000.
- `worker` — runs pg-boss, monitoring, SLA escalation, and notifications.

No Supabase service or external database is required.

## Local or VPS start

```powershell
Copy-Item .env.docker.example .env.docker
notepad .env.docker
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

Set a strong URL-safe `POSTGRES_PASSWORD`, matching `DATABASE_URL` and
`DIRECT_URL`, the admin account values, and a long random `CRON_SECRET`.
For a real VPS set `NEXT_PUBLIC_APP_URL` to the HTTPS hostname. PostgreSQL is
not published to the host; the app reaches it only over the Compose network at
`postgres:5432`.

Open `http://localhost:3000` locally, or put a TLS reverse proxy in front of
port 3000 on the VPS. The Compose stack exposes no public PostgreSQL port.

## Lifecycle

```powershell
docker compose --env-file .env.docker logs -f web worker
docker compose --env-file .env.docker exec -T postgres pg_isready -U guardian -d guardian
docker compose --env-file .env.docker exec -T web node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(async r => { console.log(await r.text()); process.exit(r.ok ? 0 : 1) }).catch(e => { console.error(e); process.exit(1) })"
docker compose --env-file .env.docker down
```

`down` preserves the database volume. `down -v` permanently removes the local
PostgreSQL data and should only be used when the data is disposable.

On Windows without GNU Make, run the local wrapper commands `.\make health`,
`.\make run`, and `.\make teardown`; the wrapper calls `scripts/guardian.ps1`.

## VPS release order

1. Install Docker Engine and Compose on the VPS.
2. Copy the repository and create `.env.docker` with production secrets.
3. Run `docker compose --env-file .env.docker up -d --build`.
4. Confirm `migrate` and `bootstrap` completed successfully, then inspect
   `docker compose ... logs worker`.
5. Configure a reverse proxy/TLS certificate to forward HTTPS to `web:3000`.
6. Allow only SSH and 80/443 through the firewall. Do not publish 5432.

The worker is required for scheduled monitoring. Keep exactly one worker until
you intentionally scale capacity; pg-boss coordinates jobs, but every worker
adds database and network load.
