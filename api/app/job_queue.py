"""Optional Redis/RQ job queue for PRAXIS fits off the API request thread."""

from __future__ import annotations

import threading

from app.config import settings

QUEUE_NAME = "praxis_jobs"


def enqueue_job(job_id: str) -> None:
    if settings.uses_job_queue():
        from redis import Redis
        from rq import Queue

        from app.jobs_runner import run_job

        conn = Redis.from_url(settings.redis_url)
        Queue(QUEUE_NAME, connection=conn).enqueue(
            run_job,
            job_id,
            job_timeout="2h",
            result_ttl=0,
            failure_ttl=86400,
        )
        return
    threading.Thread(target=_run_inline, args=(job_id,), daemon=True).start()


def _run_inline(job_id: str) -> None:
    from app.jobs_runner import run_job

    run_job(job_id)


def redis_ok() -> bool | None:
    if not settings.uses_job_queue():
        return None
    try:
        from redis import Redis

        Redis.from_url(settings.redis_url).ping()
        return True
    except Exception:
        return False
