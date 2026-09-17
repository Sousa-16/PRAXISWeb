# Contributing

Thank you for your interest in PRAXIS Web. This repo is the workshop UI + API around the PRAXIS tree search.

## Development

```bash
# API
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # optional local overrides
uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload

# Web (separate terminal)
cd web
npm ci
npm run dev
```

Or from the repo root: `docker compose up --build`.

## Tests

```bash
# API
cd api && python -m pytest tests/ -q

# Web
cd web && npx tsc --noEmit && npm test && npm run build
```

CI runs the same checks on every push and pull request to `main` (see [`.github/workflows/test.yml`](.github/workflows/test.yml)).

## Pull requests

1. Keep changes focused; prefer small PRs.
2. Do not commit secrets (`.env`, `.local-secrets/`, keys, proxy secrets, DuckDNS tokens).
3. Add or update tests when changing API behavior.
4. Run the test commands above before opening a PR.

## Security

See [SECURITY.md](SECURITY.md). Do not open issues that include real credentials or personal datasets.
