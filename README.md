# PRAXIS Web

Workshop UI and API for PRAXIS Rashomon-set decision trees.

## Layout

- **web/** — Next.js frontend (Vercel)
- **api/** — FastAPI backend (OCI / Docker)
- **ops/** — DuckDNS + Caddy runbook for the stable API URL

## Workshop flow

1. **Load a Table** — CSV or sample; optional search settings  
2. **Set Tree Rules** — won’t-have / must-use columns  
3. **Browse Trees** — pick a surviving rule  
4. **Score & export** — score a row or CSV, impact preview, download JSON / Python scorer  

Guest browser sessions own uploads (cookie). Data expires after `GUEST_TTL_HOURS` (default 24). Use **Delete my data** to wipe the session’s rows and cache files.

See [privacy](web/app/privacy/page.tsx) copy on `/privacy` and [SECURITY.md](SECURITY.md) for
guest isolation, rate limits, and operator checklist. Licensed under [MIT](LICENSE).

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the overview, [DEPLOYMENT_OCI.md](DEPLOYMENT_OCI.md) for OCI + Vercel ($0), and [ops/CADDY_DUCKDNS.md](ops/CADDY_DUCKDNS.md) for the stable API hostname.
