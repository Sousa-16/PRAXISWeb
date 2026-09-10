# Deploy on Oracle Cloud (OCI) — $0 Always Free

Stack: **Vercel** (frontend) + **OCI Ampere VM** (API) + **Supabase** (free Postgres).

```mermaid
flowchart LR
  User --> Vercel
  Vercel -->|API_PROXY_TARGET HTTPS| Tunnel[Cloudflare Tunnel or Caddy]
  Tunnel --> API[Docker API :8765]
  API --> Supabase[(Supabase Postgres)]
```

---

## What you need

| Piece | Service | Cost |
|-------|---------|------|
| Frontend | Vercel | Free |
| API | OCI Always Free VM | Free |
| HTTPS to API | Cloudflare Tunnel (recommended) | Free |
| Database | Supabase Postgres | Free tier |

---

## Part 1 — OCI VM

### 1. Create the instance

1. [cloud.oracle.com](https://cloud.oracle.com) → sign up / sign in.
2. **Compute** → **Instances** → **Create instance**.
3. **Name:** `praxis-api`
4. **Image:** Ubuntu 22.04 or 24.04.
5. **Shape:** **Ampere** → **VM.Standard.A1.Flex**
   - **2 OCPUs**, **12 GB RAM** (fits PRAXIS comfortably; stays within Always Free quota).
6. **Networking:** assign a public IPv4 address.
7. **SSH keys:** generate or upload your public key → download private key.
8. **Create**.

### 2. Open the firewall (OCI + OS)

**OCI console** → **Networking** → **Virtual cloud networks** → your VCN → **Security Lists** → default → **Add Ingress Rules**:

| Source | Port | Purpose |
|--------|------|---------|
| `0.0.0.0/0` | `22` | SSH |
| `0.0.0.0/0` | `80`, `443` | Only if using Caddy + domain |

For **Cloudflare Tunnel**, you do **not** need to expose port 8765 publicly.

**On the VM** (Ubuntu often has `iptables` too):

```bash
sudo iptables -I INPUT -p tcp --dport 22 -j ACCEPT
# optional if using Caddy:
# sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
# sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
```

---

## Part 2 — Install Docker on the VM

SSH in:

```bash
ssh -i /path/to/key ubuntu@YOUR_PUBLIC_IP
```

Then:

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER
```

Log out and SSH back in so `docker` works without `sudo`.

---

## Part 3 — Deploy the API

```bash
git clone https://github.com/Sousa-16/PRAXISWeb.git
cd PRAXISWeb
cp api/.env.example api/.env
nano api/.env   # edit values below
```

**Minimum `api/.env` for production:**

```env
# Supabase → Database → Transaction pooler (port 6543)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

FRONTEND_ORIGIN=https://praxis-web-nu.vercel.app
COOKIE_SECURE=1

BASES_CACHE_DIR=data/bases_cache
```

Start API (bound to localhost only — tunnel or Caddy will expose HTTPS):

```bash
docker compose -f docker-compose.oci.yml up -d --build
```

Check locally on the VM:

```bash
curl http://127.0.0.1:8765/health
```

Expect `"ok": true`.

View logs:

```bash
docker compose -f docker-compose.oci.yml logs -f api
```

---

## Part 4 — HTTPS (pick one)

Vercel needs an **HTTPS** URL for `API_PROXY_TARGET`.

### Option A — Cloudflare Tunnel (easiest, no domain)

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
# Use cloudflared-linux-amd64.deb if your instance is x86, not Ampere
sudo dpkg -i cloudflared.deb

cloudflared tunnel --url http://127.0.0.1:8765
```

Copy the `https://….trycloudflare.com` URL.  
**Note:** Quick tunnels change URL on restart. Prefer **[Option A2 — named tunnel](ops/NAMED_TUNNEL.md)** for production.

### Option A2 — Named Cloudflare tunnel (stable URL)

See **[ops/NAMED_TUNNEL.md](ops/NAMED_TUNNEL.md)** and `ops/cloudflared-praxis-api.service`.
Creates a fixed hostname you can set once in Vercel `API_PROXY_TARGET`.

### Option B — Caddy + domain


Point a domain (or free DuckDNS hostname) to the VM public IP. Install Caddy and reverse-proxy to `localhost:8765`. Caddy obtains Let's Encrypt certs automatically.

---

## Part 5 — Connect Vercel

1. Vercel → project → **Settings** → **Environment Variables**
2. Set:

| Variable | Value |
|----------|--------|
| `API_PROXY_TARGET` | `https://your-tunnel-or-domain-url` (no trailing slash) |

3. Push a commit or redeploy Vercel.

---

## Updating the API

```bash
cd ~/PRAXISWeb
git pull
docker compose -f docker-compose.oci.yml up -d --build
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Vercel can’t reach API | Check tunnel/Caddy is running; `API_PROXY_TARGET` is HTTPS |
| CORS / cookie errors | `FRONTEND_ORIGIN` must exactly match Vercel URL |
| `/health` `database: false` | Check `DATABASE_URL`; open Supabase pooler access |
| PRAXIS fit OOM | Use Ampere 12 GB shape, not 1 GB AMD micro |
| Tunnel URL changed | Switch to a [named tunnel](ops/NAMED_TUNNEL.md); update Vercel `API_PROXY_TARGET` |

---

## What not to run on OCI

- **Do not** run the `web` service — Vercel hosts Next.js.
- **Redis/worker** — skip (local `docker-compose.yml` also has no Redis now). Fits run in-process threads so `fit_cache` stays on the API.

## After API restart

Set Tree Rules match counts can use the NPZ bases index. Browse Trees can reuse a profile saved from a prior Continue when bans/keeps match; otherwise run **Find good rules** again. TimberTrek expand needs the live fit.

See also: [DEPLOYMENT.md](DEPLOYMENT.md) for Render and local Docker.
