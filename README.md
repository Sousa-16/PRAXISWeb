# PRAXIS Web

Find short, readable if-then rules from a labeled CSV, compare near-best trees, and score new rows with the rule you pick.

This repo is the **workshop** (UI + API). The search algorithm is PRAXIS; install the research package separately as [`tree-praxis`](https://pypi.org/project/tree-praxis/) if you want it in Python.

## Live demo

**[https://praxis-web-nu.vercel.app](https://praxis-web-nu.vercel.app)**

Open that URL. You do not need the API hostname.

## What it is

A four-step guest workshop:

1. **Load a Table** — sample email spam or your CSV; optional search settings
2. **Set Tree Rules** — mark columns as won’t-have or must-use
3. **Browse Trees** — pick a surviving rule
4. **Score & export** — score a row or CSV, preview impact, download JSON or a standalone Python scorer

PRAXIS searches a **Rashomon set**: many short decision trees that predict almost equally well. Details: [PRAXIS ICML 2026 paper](https://arxiv.org/abs/2606.00202).

## Try it

On the live site, click **Use Sample Email Spam Detection**, or upload a labeled CSV.

Do not upload secrets or personal data you would not put on a shared demo machine. Guest uploads are tied to this browser, expire after 24 hours, and can be wiped with **Delete my data**. See [Privacy](https://praxis-web-nu.vercel.app/privacy) and [SECURITY.md](SECURITY.md).

## Local run

**Docker (API + web):**

```bash
cd WebApp
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:8765

**Without Docker:**

```bash
# terminal 1
cd api && uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload

# terminal 2
cd web && npm ci && npm run dev
```

Copy [api/.env.example](api/.env.example) and [web/.env.example](web/.env.example) if you need local overrides.

## Repo map

- **web/** — Next.js frontend (Vercel). No database client.
- **api/** — FastAPI backend (OCI / Docker). Guest data is **SQLite** (`DATABASE_URL`).
- **ops/** — DuckDNS + Caddy runbook for the stable API URL

## Deploy

Overview: [DEPLOYMENT.md](DEPLOYMENT.md). OCI + Vercel ($0): [DEPLOYMENT_OCI.md](DEPLOYMENT_OCI.md). Stable API hostname: [ops/CADDY_DUCKDNS.md](ops/CADDY_DUCKDNS.md). Backups: [ops/BACKUP.md](ops/BACKUP.md).

## License

[MIT](LICENSE)
