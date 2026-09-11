# Back up guest data on the OCI VM

The live API stores:

| Path in container | What |
|-------------------|------|
| `/app/praxis_data/praxis_web.db` | SQLite (sessions, CSVs, jobs) |
| `/app/data/bases_cache` | NPZ bases index + pickled fits |

Both sit on Docker named volumes (`api_db`, `api_data`). Guest rows also expire after `GUEST_TTL_HOURS` (default 24).

## Snapshot

On the VM, from the clone:

```bash
cd ~/PRAXISWeb
chmod +x ops/backup.sh
ops/backup.sh
```

Default destination: `~/praxis-backups/<UTC-stamp>/`. Pass another directory as the first argument if you want.

Copy that folder off the VM (scp, object storage) if the backup should survive a disk wipe.

## Restore (same VM)

Stop the API, copy files into the running container paths, start again:

```bash
cd ~/PRAXISWeb
docker compose -f docker-compose.oci.yml stop api
# replace STAMP with the backup folder name
docker compose -f docker-compose.oci.yml run --rm --no-deps \
  -v "$HOME/praxis-backups/STAMP/praxis_web.db:/restore/praxis_web.db" \
  api python -c "import shutil; shutil.copy('/restore/praxis_web.db', '/app/praxis_data/praxis_web.db')"
docker compose -f docker-compose.oci.yml up -d api
```

Or `docker cp` the SQLite file and `bases_cache` directory onto the container, then `up -d`.

There is no off-site backup unless you copy `~/praxis-backups` somewhere else.
