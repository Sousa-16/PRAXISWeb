"""Cooperative cancel for in-flight jobs after Delete my data."""

from __future__ import annotations

import threading

_lock = threading.Lock()
_cancelled_jobs: set[str] = set()


def cancel_jobs(job_ids: list[str]) -> None:
    with _lock:
        _cancelled_jobs.update(job_ids)


def is_cancelled(job_id: str) -> bool:
    with _lock:
        return job_id in _cancelled_jobs


def clear_cancelled(job_id: str) -> None:
    with _lock:
        _cancelled_jobs.discard(job_id)
