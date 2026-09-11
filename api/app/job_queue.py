"""In-process thread queue for PRAXIS fits."""

from __future__ import annotations

import threading

from app.config import settings

_fit_slots = threading.Semaphore(max(1, settings.max_global_jobs))


def enqueue_job(job_id: str) -> None:
    threading.Thread(target=_run_inline, args=(job_id,), daemon=True).start()


def _run_inline(job_id: str) -> None:
    from app.jobs_runner import run_job

    # Cap concurrent PRAXIS fits so one VM cannot be stacked with unbounded threads.
    with _fit_slots:
        run_job(job_id)
