"""In-memory fitted PRAXIS models keyed by job id, with a disk sidecar for API restarts."""

from __future__ import annotations

import gzip
import pickle
from typing import Any

from app.config import settings

_CACHE: dict[str, Any] = {}


def _disk_path(job_id: str):
    return settings.bases_cache_path() / f"{job_id}.bundle.pkl"


def persist(job_id: str, bundle: Any) -> None:
    """Best-effort pickle so Browse/profile can survive an API restart."""
    try:
        cache = settings.bases_cache_path()
        cache.mkdir(parents=True, exist_ok=True)
        tmp = _disk_path(job_id).with_suffix(".pkl.tmp")
        with gzip.open(tmp, "wb") as fh:
            pickle.dump(bundle, fh, protocol=pickle.HIGHEST_PROTOCOL)
        tmp.replace(_disk_path(job_id))
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
        return None


def drop_disk(job_id: str) -> None:
    path = _disk_path(job_id)
    try:
        if path.is_file():
            path.unlink()
    except Exception:
        pass


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
