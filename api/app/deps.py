"""FastAPI request dependencies shared by routers."""

from __future__ import annotations

from fastapi import Request

from app.auth import Identity


def identity_dep(request: Request) -> Identity:
    return request.state.identity
