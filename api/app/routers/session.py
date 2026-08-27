from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.auth import Identity
from app.config import settings
from app.db import get_session
from app.deps import identity_dep
from app.owners import attach_guest_to_user, wipe_identity
from app.search import search_owned

router = APIRouter(tags=["session"])


@router.get("/health")
def health():
    return {"ok": True, "auth": bool(settings.supabase_jwt_secret)}


@router.get("/v1/me")
def me(ident: Identity = Depends(identity_dep)):
    return {
        "session_id": ident.session_id[:6] + "…",
        "signed_in": bool(ident.user_id),
        "guest_ttl_hours": None if ident.user_id else settings.guest_ttl_hours,
        "notice": (
            "Other visitors cannot open your uploads. They are tied to this browser"
            " (or your account if you sign in). Guest data is deleted after "
            f"{settings.guest_ttl_hours} hours. The server and data host can still "
            "access stored rows. Do not upload secrets on the web app. "
            "Instead download PRAXIS Web locally."
        ),
    }


@router.post("/v1/auth/attach")
def attach(session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    if not ident.user_id:
        raise HTTPException(401, "Sign in first.")
    n = attach_guest_to_user(session, ident)
    return {"attached": n}


@router.delete("/v1/me/data")
def delete_mine(session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    wipe_identity(session, ident)
    return {"ok": True}


@router.get("/v1/search")
def search(q: str = "", session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    return search_owned(session, ident, q)
