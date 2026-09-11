"""In-memory fitted PRAXIS models keyed by job id, with a disk sidecar for API restarts."""

from __future__ import annotations

import gzip
import logging
import pickle
from typing import Any

from app.config import settings

log = logging.getLogger(__name__)

_CACHE: dict[str, Any] = {}


def _disk_path(job_id: str):
    return settings.bases_cache_path() / f"{job_id}.bundle.pkl"


def persist(job_id: str, bundle: Any) -> None:
    """Pickle so Browse / TimberTrek expand can survive an API restart."""
    cache = settings.bases_cache_path()
    cache.mkdir(parents=True, exist_ok=True)
    dest = _disk_path(job_id)
    tmp = dest.with_suffix(".pkl.tmp")
    try:
        with gzip.open(tmp, "wb") as fh:
            pickle.dump(bundle, fh, protocol=pickle.HIGHEST_PROTOCOL)
        tmp.replace(dest)
        return
    except Exception:
        log.exception("gzip pickle failed for job %s; trying uncompressed", job_id)
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass
    try:
        with open(tmp, "wb") as fh:
            pickle.dump(bundle, fh, protocol=pickle.HIGHEST_PROTOCOL)
        tmp.replace(dest)
    except Exception:
        log.exception("Could not persist fit bundle for job %s", job_id)
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass


def _load_disk(job_id: str) -> Any | None:
    path = _disk_path(job_id)
    if not path.is_file():
        return None
    try:
        with gzip.open(path, "rb") as fh:
            return pickle.load(fh)
    except Exception:
        try:
            with open(path, "rb") as fh:
                return pickle.load(fh)
        except Exception:
            log.exception("Could not load fit bundle for job %s", job_id)
            return None


def drop_disk(job_id: str) -> None:
    path = _disk_path(job_id)
    try:
        if path.is_file():
            path.unlink()
    except Exception:
        log.exception("Could not delete fit bundle for job %s", job_id)


def put(job_id: str, bundle: Any) -> None:
    _CACHE[job_id] = bundle
    persist(job_id, bundle)


def get(job_id: str) -> Any | None:
    hit = _CACHE.get(job_id)
    if hit is not None:
        return hit
    loaded = _load_disk(job_id)
    if loaded is not None:
        _CACHE[job_id] = loaded
    return loaded


def pop(job_id: str) -> Any | None:
    drop_disk(job_id)
    return _CACHE.pop(job_id, None)


def clear() -> None:
    _CACHE.clear()


def warm_from_disk() -> int:
    """Load pickle sidecars into memory after an API restart. Returns how many loaded."""
    cache = settings.bases_cache_path()
    if not cache.is_dir():
        return 0
    n = 0
    for path in cache.glob("*.bundle.pkl"):
        job_id = path.name[: -len(".bundle.pkl")]
        if get(job_id) is not None:
            n += 1
    if n:
        log.info("Reloaded %s fitted model(s) from disk", n)
    return n
