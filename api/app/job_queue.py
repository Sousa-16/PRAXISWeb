"""In-process thread queue for PRAXIS fits."""

from __future__ import annotations

import threading


def enqueue_job(job_id: str) -> None:
    threading.Thread(target=_run_inline, args=(job_id,), daemon=True).start()


def _run_inline(job_id: str) -> None:
    from app.jobs_runner import run_job

    run_job(job_id)
