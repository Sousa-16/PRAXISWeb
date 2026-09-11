from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlmodel import Session, col, select

from app import bases_store, fit_cache
from app.auth import Identity
from app.config import settings
from app.models import Dataset, Job

# Jobs queued/running before this process started have no worker (API restart).
PROCESS_BOOTED_AT = datetime.now(timezone.utc)
_ORPHAN_ERROR = "Search stopped because the API restarted. Find good rules again."


def guest_deadline() -> datetime | None:
    if not settings.guest_ttl_hours:
        return None
    return datetime.now(timezone.utc) + timedelta(hours=settings.guest_ttl_hours)


def stamp_owner(ident: Identity) -> dict:
    return {
        "session_id": ident.session_id,
        "delete_after": guest_deadline(),
    }


def owner_clause(model, ident: Identity):
    return col(model.session_id) == ident.session_id


def get_owned_dataset(session: Session, ident: Identity, dataset_id: str) -> Dataset | None:
    return session.exec(
        select(Dataset).where(Dataset.id == dataset_id).where(owner_clause(Dataset, ident))
    ).first()


def get_owned_job(session: Session, ident: Identity, job_id: str) -> Job | None:
    return session.exec(select(Job).where(Job.id == job_id).where(owner_clause(Job, ident))).first()


def global_active_job_count(session: Session) -> int:
    rows = session.exec(select(Job).where(col(Job.status).in_(["queued", "running"]))).all()
    return len(rows)


def active_job_count(session: Session, ident: Identity) -> int:
    rows = session.exec(
        select(Job).where(owner_clause(Job, ident)).where(col(Job.status).in_(["queued", "running"]))
    ).all()
    return len(rows)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _drop_job_caches(job_id: str) -> None:
    try:
        bases_store.drop(job_id)
    except Exception:
        pass
    fit_cache.pop(job_id)


def abandon_orphaned_jobs(session: Session) -> int:
    """Mark leftover queued/running jobs failed after an API restart."""
    rows = session.exec(select(Job).where(col(Job.status).in_(["queued", "running"]))).all()
    n = 0
    now = datetime.now(timezone.utc)
    for job in rows:
        created = _aware(job.created_at)
        if created is not None and created >= PROCESS_BOOTED_AT:
            continue
        job.status = "failed"
        job.error = _ORPHAN_ERROR
        job.finished_at = now
        session.add(job)
        n += 1
    if n:
        session.commit()
    return n


def purge_expired(session: Session) -> int:
    now = datetime.now(timezone.utc)
    n = 0
    jobs = session.exec(
        select(Job).where(col(Job.delete_after).is_not(None)).where(col(Job.delete_after) < now)
    ).all()
    for job in jobs:
        _drop_job_caches(job.id)
        session.delete(job)
        n += 1
    datasets = session.exec(
        select(Dataset).where(col(Dataset.delete_after).is_not(None)).where(col(Dataset.delete_after) < now)
    ).all()
    for row in datasets:
        session.delete(row)
        n += 1
    if n:
        session.commit()
    return n


def wipe_identity(session: Session, ident: Identity) -> None:
    jobs = session.exec(select(Job).where(owner_clause(Job, ident))).all()
    for job in jobs:
        _drop_job_caches(job.id)
        session.delete(job)
    datasets = session.exec(select(Dataset).where(owner_clause(Dataset, ident))).all()
    for row in datasets:
        session.delete(row)
    session.commit()
