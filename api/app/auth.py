"""Guest session cookie identity (no account sign-in)."""

from __future__ import annotations

import secrets
from dataclasses import dataclass

from fastapi import Request

COOKIE = "praxis_web_sid"


@dataclass
class Identity:
    session_id: str
    user_id: str | None = None
    new_cookie: bool = False


def read_identity(request: Request) -> Identity:
    raw = request.cookies.get(COOKIE)
    new_cookie = False
    if not raw:
        raw = secrets.token_urlsafe(24)
        new_cookie = True
    return Identity(session_id=raw, user_id=None, new_cookie=new_cookie)
