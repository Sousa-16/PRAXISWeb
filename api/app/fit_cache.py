"""In-memory fitted PRAXIS models keyed by job id. Lost on API restart."""

from __future__ import annotations

from typing import Any

_CACHE: dict[str, Any] = {}


def put(job_id: str, bundle: Any) -> None:
    _CACHE[job_id] = bundle


def get(job_id: str) -> Any | None:
    return _CACHE.get(job_id)


def pop(job_id: str) -> Any | None:
    return _CACHE.pop(job_id, None)


def clear() -> None:
    _CACHE.clear()
