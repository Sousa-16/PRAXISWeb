# Local secrets (do not commit)

Store SSH private keys and other deploy secrets here. This directory is
gitignored except for this README.

Typical files (local only):

- `*.key` — OCI VM SSH private key (`chmod 600`)
- `*proxy-secret*` — shared `PRAXIS_PROXY_SECRET` reference (same value as Vercel)

```bash
ssh -i .local-secrets/<your-oci-key>.key ubuntu@YOUR_PUBLIC_IP
```
