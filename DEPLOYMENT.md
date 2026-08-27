# PRAXIS Web deployment

Production topology: **Vercel** (Next.js) → **API host** (Fly/Railway/Docker) → **Supabase** (Postgres + optional Auth).

```mermaid
flowchart TB
  subgraph vercel [Vercel]
    NextApp[Next.js]
  end
  subgraph api_host [API host]
    API[FastAPI]
    Worker[RQ worker optional]
    Vol[Persistent volume or S3]
  end
  subgraph supabase [Supabase]
    Auth[Auth]
    PG[Postgres]
    Storage[S3-compatible Storage optional]
  end
  User --> NextApp
  NextApp -->|API_PROXY_TARGET| API
  User -->|optional| Auth
  API --> PG
  Worker --> PG
  API --> Vol
  Worker --> Vol
```

## 1. Supabase Postgres

1. Create a Supabase project.
2. Copy the **transaction pooler** connection string (port `6543`) for the API.
3. On the API host, set:

```bash
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Use the **direct** connection (port `5432`) only for one-off admin or `alembic upgrade head`.

Tables (`datasets`, `jobs`, `policies`) are created by Alembic on API startup.

## 2. Supabase Auth (optional)

| Where | Variable | Source |
|-------|----------|--------|
| Vercel | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
| Vercel | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API |
| API host | `SUPABASE_JWT_SECRET` | Project Settings → API → JWT Secret |
| API host | `FRONTEND_ORIGIN` | Your Vercel URL, e.g. `https://praxis-web.vercel.app` |
| API host | `COOKIE_SECURE=1` | Required in production |

Guest mode works with no Supabase vars. Sign-in attaches guest uploads to the account via `POST /v1/auth/attach`.

## 3. API host (Fly.io example)

From `WebApp/api`:

```bash
fly launch --no-deploy
fly volumes create bases_cache --size 1
fly secrets set \
  DATABASE_URL='postgresql://...' \
  SUPABASE_JWT_SECRET='...' \
  FRONTEND_ORIGIN='https://your-app.vercel.app' \
  COOKIE_SECURE=1
fly deploy
```

Optional Redis worker (recommended for production fits):

```bash
fly secrets set REDIS_URL='redis://...'
# Scale a worker machine running: python worker.py
```

See [`fly.toml`](api/fly.toml) for volume mount at `/app/data/bases_cache`.

## 4. Vercel (frontend)

1. Import the repo; set root directory to `WebApp/web`.
2. Environment variables:

| Variable | Value |
|----------|-------|
| `API_PROXY_TARGET` | Public API URL, e.g. `https://praxis-web-api.fly.dev` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

Next.js rewrites `/v1/*` and `/health` to the API (see [`next.config.ts`](web/next.config.ts)).

## 5. Local production-like stack

```bash
cd WebApp
cp api/.env.example api/.env   # edit DATABASE_URL if using Supabase
docker compose up --build
```

- Web: http://localhost:3000  
- API: http://localhost:8765  
- Redis + worker: enabled when `REDIS_URL` is set in compose

## 6. Object storage (multi-instance API)

For horizontal scaling, store bases NPZ files in S3-compatible storage instead of local disk:

```bash
OBJECT_STORAGE_BACKEND=s3
S3_ENDPOINT=https://[ref].storage.supabase.co/storage/v1/s3
S3_BUCKET=praxis-bases
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_REGION=us-east-1
S3_PREFIX=bases_cache
```

Supabase: Project Settings → Storage → S3 connection.

## 7. Migrations

```bash
cd WebApp/api
alembic upgrade head
```

Migrations also run automatically on API startup.

## 8. Health check

`GET /health` returns:

- `database` — Postgres/SQLite reachable  
- `storage` — local cache dir writable or S3 bucket reachable  
- `redis` — `true`/`false`/`null` (null when not configured)  
- `auth` — whether JWT verification is enabled  
- `ok` — overall readiness

## 9. Limitations

- **In-memory fit cache** is still lost on API restart; re-run **Find good rules** for TimberTrek expand and full profile. Disk/S3 bases cache preserves live match counts only.
- CSV bytes are stored in Postgres (fine for demo; consider Supabase Storage for large files later).
