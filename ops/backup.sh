#!/bin/sh
# Snapshot SQLite + NPZ/pickle cache from the OCI API container.
# Run on the VM from the repo root:  ops/backup.sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
DEST=${1:-"$HOME/praxis-backups"}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$DEST/$STAMP"
COMPOSE="$ROOT/docker-compose.oci.yml"

mkdir -p "$OUT"

cid=$(docker compose -f "$COMPOSE" ps -q api)
if [ -z "$cid" ]; then
  echo "API container is not running." >&2
  exit 1
fi

docker compose -f "$COMPOSE" exec -T api python - <<'PY'
import sqlite3
from pathlib import Path

src = Path("/app/praxis_data/praxis_web.db")
dst = Path("/tmp/praxis_web.backup.db")
if not src.is_file():
    raise SystemExit("SQLite file not found at /app/praxis_data/praxis_web.db")
dst.unlink(missing_ok=True)
with sqlite3.connect(src) as con:
    con.backup(sqlite3.connect(dst))
print("ok")
PY

docker cp "$cid:/tmp/praxis_web.backup.db" "$OUT/praxis_web.db"
docker cp "$cid:/app/data/bases_cache" "$OUT/bases_cache"
echo "Wrote $OUT"
