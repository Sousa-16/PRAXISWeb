# PRAXIS Web

![Status: Prototype](https://img.shields.io/badge/status-prototype-orange.svg)
![Live demo](https://img.shields.io/badge/demo-live-success.svg)
![CI](https://github.com/Sousa-16/PRAXISWeb/actions/workflows/test.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Python](https://img.shields.io/badge/Python-3.12-blue)

**Public guest workshop for PRAXIS**: find short, readable if-then rules from a labeled CSV, compare near-best trees, score new rows, and export a scorer.

**[Live demo](https://praxis-web-nu.vercel.app)**

![PRAXIS Web landing: sample spam and upload CSV CTAs](docs/images/landing.jpg)

![Load a Table: spam sample loaded with label column and Find good rules](docs/images/load-table.jpg)

[Watch the workshop tour (MP4)](docs/images/workshop-tour.mp4)

## Project goal

Make the PRAXIS Rashomon-set search usable in a browser: upload (or sample) a table, constrain features, pick a short tree you can read, then score and export, without accounts and without exposing the research package as a SaaS backend.

This repo is the **workshop** (UI + API + deploy). The algorithm is the separate package [`tree-praxis`](https://pypi.org/project/tree-praxis/) ([ICML 2026 paper](https://arxiv.org/abs/2606.00202)).

## Project status

**Prototype / portfolio demo**: intentionally scoped for a shared guest machine, not multi-tenant production.

| | |
| :--- | :--- |
| Audience | Recruiters, reviewers, curious practitioners |
| Hosting | Live on Vercel + OCI Always Free |
| Data model | Ephemeral guest SQLite (24h TTL + Delete my data) |
| Not in scope | Auth, billing, multi-region HA, production SLAs |

OpenAPI is off in production. Treat uploads like data on a borrowed laptop ([SECURITY.md](SECURITY.md)).

## Why this matters

Most "best" models hide near-equally good alternatives. A **Rashomon set** of short trees lets you choose a rule you can explain, which is useful when accuracy alone is not enough (compliance, safety, domain vetoes on features). This app turns that research idea into a guided workshop with constraints, comparison, scoring, and export.

## Product value

| For visitors | For operators / portfolio |
| :--- | :--- |
| Zero setup: sample spam path in one click | End-to-end system design on a $0 stack |
| Readable rules, not a black-box score | Guest isolation, rate limits, cancelable wipe |
| Export JSON or a standalone Python scorer | Reproducible deploy docs (OCI + Vercel + Caddy) |

## Deployment status

| Surface | Status |
| :--- | :--- |
| Frontend | **Live**: [praxis-web-nu.vercel.app](https://praxis-web-nu.vercel.app) |
| API | **Live**: FastAPI on OCI behind Caddy/DuckDNS (proxied; not for direct visitor use) |
| CI | GitHub Actions on `main` ([workflow](https://github.com/Sousa-16/PRAXISWeb/actions/workflows/test.yml)) |
| Cost | Designed for Always Free OCI + Vercel hobby |

Runbooks: [DEPLOYMENT.md](DEPLOYMENT.md) · [DEPLOYMENT_OCI.md](DEPLOYMENT_OCI.md) · [ops/CADDY_DUCKDNS.md](ops/CADDY_DUCKDNS.md).

## My role

I designed and built the guest workshop end to end:

- Next.js 16 UI (four-step flow, polling, export)
- FastAPI jobs API (fit workers, constraints, score/freeze)
- Guest cookie isolation, abuse limits, Delete my data
- OCI Docker + Vercel proxy + Caddy/DuckDNS HTTPS path

PRAXIS / `tree-praxis` is the research algorithm (separate package and paper). My contribution is the **product and infrastructure around it**.

## Key features

- **Four-step workshop**: Load → constrain → browse → score/export
- **Sample spam dataset**: UCI Spambase-based demo CSV ([provenance](api/data/README.md))
- **Feature constraints**: won't-have / must-use columns with live survivor counts
- **Rashomon browsing**: pick among short near-best trees
- **Score & export**: single row, batch CSV, impact preview, JSON + offline Python scorer
- **Guest safety**: session ownership, rate limits, 24h TTL, one-click wipe (cancels in-flight fits)

## Architecture

```mermaid
flowchart LR
  visitor[Visitor] --> vercel[Vercel_Next.js]
  vercel -->|"/v1/* proxy"| caddy[Caddy_HTTPS]
  caddy --> api[FastAPI_OCI]
  api --> sqlite[(SQLite_guests)]
  api --> praxis[tree_praxis_fit]
```

Visitors only use the Vercel URL. Next.js proxies `/v1/*`, attaches the guest cookie, and can forward client IP when `PRAXIS_PROXY_SECRET` matches. Fits run in background threads on the VM; the UI polls job status.

Deeper write-up: [How the model and UI interact](docs/how-model-and-ui-interact.md).

### Stack

| Layer | Tech |
| :--- | :--- |
| Frontend | Next.js 16 (App Router), TypeScript on Vercel |
| Backend | FastAPI, SQLAlchemy, SQLite in Docker on OCI |
| HTTPS API | Caddy + DuckDNS |
| Algorithm | [`tree-praxis`](https://pypi.org/project/tree-praxis/) |

### API (compact)

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `POST` | `/v1/datasets` | Upload labeled CSV |
| `POST` | `/v1/datasets/sample` | Load spam sample |
| `POST` | `/v1/jobs` | Start PRAXIS search |
| `GET` | `/v1/jobs/{id}` | Job status / result |
| `POST` | `/v1/jobs/{id}/profile` | Profile trees under constraints |
| `POST` | `/v1/jobs/{id}/score` | Score one row |
| `POST` | `/v1/jobs/{id}/freeze` | Freeze rule for export |
| `DELETE` | `/v1/me/data` | Wipe this browser's guest data |

## Setup instructions

### Docker (recommended)

```bash
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:8765

### Without Docker

```bash
# terminal 1: API
cd api && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload

# terminal 2: web
cd web && npm ci && npm run dev
```

Copy [api/.env.example](api/.env.example) and [web/.env.example](web/.env.example) for local overrides.

### Tests

```bash
cd api && python -m pytest tests/ -q
cd web && npx tsc --noEmit && npm test && npm run build
```

### Repo map

| Path | Role |
| :--- | :--- |
| `web/` | Next.js frontend (no DB client) |
| `api/` | FastAPI + SQLite guest store |
| `ops/` | Caddy / DuckDNS / backup runbooks |
| `docs/` | Screenshots, tour video, write-ups |

## Technical write-up

**[How the model and UI interact](docs/how-model-and-ui-interact.md)**: cookie → job poll → fit → constrain → freeze/score/export

## License

[MIT](LICENSE). Copyright (c) 2026 Matheus Sousa
