from __future__ import annotations

import json

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.auth import Identity
from app.config import settings
from app.models import Policy
from app.owners import owner_clause


def _policy_hit(policy: Policy) -> dict:
    name = ""
    try:
        name = str((json.loads(policy.policy_json) or {}).get("name") or "")
    except (TypeError, ValueError):
        name = ""
    return {"id": policy.id, "job_id": policy.job_id, "tree_id": policy.tree_id, "name": name}


def search_owned(session: Session, ident: Identity, query: str) -> dict:
    q = (query or "").strip()
    if not q:
        return {"policies": []}
    if settings.is_postgres():
        return _postgres_fts(session, ident, q)
    needle = q.lower()
    policies = session.exec(select(Policy).where(owner_clause(Policy, ident))).all()
    return {
        "policies": [
            _policy_hit(p)
            for p in policies
            if needle in (p.search_document or "").lower()
        ],
    }


def _postgres_fts(session: Session, ident: Identity, q: str) -> dict:
    # plainto_tsquery on a stored document column
    pol_sql = (
        select(Policy)
        .where(owner_clause(Policy, ident))
        .where(
            func.to_tsvector("english", col(Policy.search_document)).op("@@")(
                func.plainto_tsquery("english", q)
            )
        )
    )
    try:
        policies = session.exec(pol_sql).all()
    except Exception:
        session.rollback()
        needle = q.lower()
        policies = [
            p
            for p in session.exec(select(Policy).where(owner_clause(Policy, ident))).all()
            if needle in (p.search_document or "").lower()
        ]
    return {
        "policies": [_policy_hit(p) for p in policies],
    }
