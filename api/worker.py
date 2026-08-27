#!/usr/bin/env python3
"""RQ worker for PRAXIS compile jobs. Run: python worker.py"""

from __future__ import annotations

from redis import Redis
from rq import Worker

from app.config import settings
from app.job_queue import QUEUE_NAME

if not settings.redis_url:
    raise SystemExit("REDIS_URL is not set.")

if __name__ == "__main__":
    conn = Redis.from_url(settings.redis_url)
    Worker([QUEUE_NAME], connection=conn).work()
