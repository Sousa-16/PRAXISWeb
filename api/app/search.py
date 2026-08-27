from __future__ import annotations

import json

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.auth import Identity
from app.config import settings
from app.models import Job, Policy
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
        return {"jobs": [], "policies": []}
    if settings.is_postgres():
        return _postgres_fts(session, ident, q)
    needle = q.lower()
    jobs = session.exec(select(Job).where(owner_clause(Job, ident))).all()
    policies = session.exec(select(Policy).where(owner_clause(Policy, ident))).all()
    return {
        "jobs": [
            {"id": j.id, "label": j.label, "status": j.status}
            for j in jobs
            if needle in (j.search_document or "").lower() or needle in (j.label or "").lower()
        ],
        "policies": [
            _policy_hit(p)
            for p in policies
            if needle in (p.search_document or "").lower()
        ],
    }


def _postgres_fts(session: Session, ident: Identity, q: str) -> dict:
    # plainto_tsquery on a stored document column
    job_sql = (
        select(Job)
        .where(owner_clause(Job, ident))
        .where(
            func.to_tsvector("english", col(Job.search_document)).op("@@")(
                func.plainto_tsquery("english", q)
            )
        )
    )
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
        jobs = session.exec(job_sql).all()
        policies = session.exec(pol_sql).all()
    except Exception:
        session.rollback()
        needle = q.lower()
        jobs = [
            j
            for j in session.exec(select(Job).where(owner_clause(Job, ident))).all()
            if needle in (j.search_document or "").lower()
        ]
        policies = [
            p
            for p in session.exec(select(Policy).where(owner_clause(Policy, ident))).all()
            if needle in (p.search_document or "").lower()
        ]
    return {
        "jobs": [{"id": j.id, "label": j.label, "status": j.status} for j in jobs],
        "policies": [_policy_hit(p) for p in policies],
    }
