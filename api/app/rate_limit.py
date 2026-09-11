"""Simple per-session rate limits for expensive endpoints."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException

from app.config import settings

_lock = Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)


def check_rate(session_id: str, action: str, *, limit: int | None = None, window_s: float = 60.0) -> None:
    """Raise 429 if this session exceeded `limit` calls to `action` in the window."""
    max_hits = limit if limit is not None else max(3, settings.max_active_jobs + 2)
    key = f"{session_id}:{action}"
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window_s:
            q.popleft()
        if len(q) >= max_hits:
            raise HTTPException(429, "Too many requests. Wait a moment and try again.")
        q.append(now)


def check_session_and_ip(
    session_id: str,
    ip: str,
    action: str,
    *,
    limit: int,
    window_s: float,
    ip_limit: int | None = None,
) -> None:
    check_rate(session_id, action, limit=limit, window_s=window_s)
    check_rate(ip, f"{action}_ip", limit=ip_limit if ip_limit is not None else limit * 2, window_s=window_s)
