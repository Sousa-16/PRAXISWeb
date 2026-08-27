"""Guest session cookie + optional Supabase JWT."""

from __future__ import annotations

import secrets
from dataclasses import dataclass

import jwt
from fastapi import Request

from app.config import settings

COOKIE = "praxis_web_sid"


@dataclass
class Identity:
    session_id: str
    user_id: str | None
    new_cookie: bool = False


def parse_supabase_user(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    secret = settings.supabase_jwt_secret
    if not token or not secret:
        return None
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    return str(sub) if sub else None


def read_identity(request: Request) -> Identity:
    raw = request.cookies.get(COOKIE)
    new_cookie = False
    if not raw:
        raw = secrets.token_urlsafe(24)
        new_cookie = True
    user_id = parse_supabase_user(request.headers.get("authorization"))
    return Identity(session_id=raw, user_id=user_id, new_cookie=new_cookie)
