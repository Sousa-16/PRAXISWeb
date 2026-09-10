# Named Cloudflare tunnel for a stable API URL

Quick tunnels (`cloudflared tunnel --url …`) change hostname on every restart and break
Vercel `API_PROXY_TARGET`. Use a **named tunnel** instead.

## One-time setup (on the OCI VM)

```bash
# Install cloudflared (arm64 Ampere example)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

cloudflared tunnel login
cloudflared tunnel create praxis-api
```

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /home/ubuntu/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: praxis-api.yourdomain.com   # or a Cloudflare-managed subdomain
    service: http://127.0.0.1:8765
  - service: http_status:404
```

Point a DNS CNAME (Cloudflare dashboard → DNS) from `praxis-api.yourdomain.com` to
`<TUNNEL_UUID>.cfargotunnel.com`, proxied.

Install the systemd unit from this repo:

```bash
sudo cp ~/PRAXISWeb/ops/cloudflared-praxis-api.service /etc/systemd/system/
# Ensure ExecStart path matches `which cloudflared`
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared-praxis-api
sudo systemctl status cloudflared-praxis-api
```

Set Vercel `API_PROXY_TARGET` to `https://praxis-api.yourdomain.com` (no trailing slash)
and set API `FRONTEND_ORIGIN` to your Vercel URL.
