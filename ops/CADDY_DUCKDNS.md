# Stable API URL with DuckDNS + Caddy (no paid domain)

Quick Cloudflare tunnels change hostname on restart. A **DuckDNS** name plus
**Caddy** on the OCI VM gives a permanent HTTPS URL for Vercel `API_PROXY_TARGET`.

Visitors still only see `https://praxis-web-nu.vercel.app`. This hostname is
backend-only.

## One-time setup

### 1. Create the DuckDNS hostname

1. Open [https://www.duckdns.org](https://www.duckdns.org) and sign in (GitHub is fine).
2. Create a subdomain, e.g. `praxis-web-api` → `praxis-web-api.duckdns.org`.
3. Set the IPv4 address to the VM public IP: `150.136.81.148`.
4. Copy your **token** from the DuckDNS dashboard.

### 2. Open ports 80 and 443 in Oracle Cloud

**Networking** → **Virtual Cloud Networks** → your VCN → **Security Lists** →
default → **Add Ingress Rules**:

| Source | Protocol | Destination port |
|--------|----------|------------------|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(SSH `22` should already be open. Do **not** open `8765` publicly.)

Also open the same ports on the VM OS (iptables). They must sit **before** the
`REJECT` rule:

```bash
sudo iptables -I INPUT 5 -p tcp -m state --state NEW --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp -m state --state NEW --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### 3. On the OCI VM

```bash
# DuckDNS credentials (never commit the token)
mkdir -p ~/.duckdns
cat > ~/.duckdns/config <<'EOF'
DOMAIN=praxis-web-api
TOKEN=paste-your-token-here
EOF
chmod 600 ~/.duckdns/config

# Keep the hostname pointed at this VM if the public IP ever changes
chmod +x ~/PRAXISWeb/ops/duckdns-update.sh
sudo cp ~/PRAXISWeb/ops/duckdns.service ~/PRAXISWeb/ops/duckdns.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now duckdns.timer
~/PRAXISWeb/ops/duckdns-update.sh

# Install Caddy
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy

sudo cp ~/PRAXISWeb/ops/Caddyfile /etc/caddy/Caddyfile
# If your hostname is not praxis-web-api.duckdns.org, edit /etc/caddy/Caddyfile first.
sudo systemctl enable --now caddy
sudo systemctl reload caddy
curl -sS https://praxis-web-api.duckdns.org/health
```

Caddy obtains a Let's Encrypt certificate automatically. DNS must already
resolve to this VM before the first `reload`.

### 4. Point Vercel at the hostname (once)

Vercel → project → **Settings** → **Environment Variables**:

| Variable | Value |
|----------|--------|
| `API_PROXY_TARGET` | `https://praxis-web-api.duckdns.org` (no trailing slash) |

Redeploy the frontend (or push any commit). Leave API `FRONTEND_ORIGIN` as
`https://praxis-web-nu.vercel.app`.

You can stop any leftover `cloudflared tunnel --url …` process after this
health check succeeds.

## Ongoing maintenance

| Event | What you do |
|-------|-------------|
| VM reboot | Nothing — Caddy, Docker, and DuckDNS timer start on boot |
| Let's Encrypt renewal | Nothing — Caddy renews the cert |
| Public IP change (rare) | DuckDNS timer updates the A record within 5 minutes |
| API code change | Same as before: rsync/pull + `docker compose -f docker-compose.oci.yml up -d --build api` |
