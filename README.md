# PRAXIS Web

Workshop UI and API for PRAXIS Rashomon-set decision trees.

## Layout

- **web/** — Next.js frontend (Vercel)
- **api/** — FastAPI backend (OCI / Docker)
- **ops/** — named Cloudflare tunnel runbook + systemd unit

## Workshop flow

1. **Load a Table** — CSV or sample; optional search settings  
2. **Set Tree Rules** — won’t-have / must-use columns  
3. **Browse Trees** — pick a surviving rule  
4. **Score & export** — score a row or CSV, impact preview, download JSON / Python scorer  

Guest browser sessions own uploads (cookie). Data expires after `GUEST_TTL_HOURS` (default 24). Use **Delete my data** to wipe the session’s rows and cache files.

See [privacy](web/app/privacy/page.tsx) copy on `/privacy`. Licensed under [MIT](LICENSE).

## Deploy

See [DEPLOYMENT_OCI.md](DEPLOYMENT_OCI.md) for **OCI + Vercel** ($0), [ops/NAMED_TUNNEL.md](ops/NAMED_TUNNEL.md) for a stable API URL, or [DEPLOYMENT.md](DEPLOYMENT.md) for Render and local Docker.
