# Security and abuse limits

PRAXIS Web is a **public guest demo**. Treat the VM and database as a shared
lab machine: do not upload secrets or personal data you would not put on a
borrowed laptop.

Visitors use `https://praxis-web-nu.vercel.app`. The API hostname is backend-only.

## What is already isolated

| Control | Effect |
|---------|--------|
| Guest cookie (`praxis_web_sid`, HttpOnly, Secure, SameSite=Lax) | Uploads and jobs belong to one browser |
| Ownership checks | Other visitors cannot read or delete your rows through the API |
| CORS | Only the Vercel origin can call the API from a browser |
| 24h TTL + scheduled purge | Guest rows and cache files expire |
| Delete my data | Wipes that cookie’s datasets, jobs, and cache files |

The **server operator** (you) can still see guest data in Postgres and on disk.

## Usage limits (crash / overload)

These defaults live in `api/app/config.py` and can be overridden in `api/.env`.

| Limit | Default | Purpose |
|-------|---------|---------|
| `MAX_UPLOAD_BYTES` | 8 MB | Caps CSV size |
| `MAX_ROWS` | 20,000 | Caps table size for upload and scoring |
| `MAX_ACTIVE_JOBS` | 1 | One search at a time per browser |
| `MAX_GLOBAL_JOBS` | 2 | At most two PRAXIS fits on the whole VM |
| `fit_rows` / `max_trees` | max 2,000 | Caps search cost in the UI and API |
| Uploads | 4 / session / min, 8 / IP / min | Slows flood uploads |
| Find good rules | 3 / session / 5 min, 6 / IP / 5 min | Expensive CPU/RAM |
| TimberTrek / score CSV | 4 / session / 2 min | Caps expand and batch score |
| Guest TTL | 24 hours | Auto-deletes leftover data |

If a third search starts while two are running, the API returns **429**
(“The demo is busy…”). Extra fits also wait on an in-process semaphore so
threads cannot pile up unbounded.

## What a public attacker can and cannot do

**Can:** use the workshop; fill CPU/RAM until limits kick in; make the demo
slow or briefly unavailable.

**Cannot (by using the website normally):** read your GitHub, Vercel, or
Supabase passwords; open other visitors’ uploads; SSH into the VM; change
deploy settings.

**Can if credentials leak:** anything those credentials allow. Keep
`api/.env`, DuckDNS token, and SSH keys off GitHub.

## Operator checklist

1. Never commit `api/.env`, `*.key`, or DuckDNS tokens.
2. SSH: key-only login (no password). Optional: `fail2ban` on port 22.
3. OCI security list: **22, 80, 443** only. Do **not** open **8765**.
4. `FRONTEND_ORIGIN` must exactly match the Vercel URL; `COOKIE_SECURE=1`.
5. Strong Supabase password; only the VM should have `DATABASE_URL`.
6. Optional: ping `https://YOUR_API_HOST/health` with a free uptime checker.
7. If abused: lower the env vars above, block IPs in iptables, or stop the
   API container until it calms down.

## Docs vs live IPs

Runbooks use **`YOUR_VM_PUBLIC_IP`**, not a hardcoded address. The live
hostname already publishes the current A record via DuckDNS.

See [DEPLOYMENT.md](DEPLOYMENT.md) and [ops/CADDY_DUCKDNS.md](ops/CADDY_DUCKDNS.md).
