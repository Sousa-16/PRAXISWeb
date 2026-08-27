from __future__ import annotations

import json
import secrets
import threading

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.auth import Identity
from app.config import settings
from app.db import get_session
from app.deps import identity_dep
from app.jobs_runner import run_job
from app.models import Dataset, Job
from app.owners import (
    abandon_orphaned_jobs,
    active_job_count,
    get_owned_dataset,
    get_owned_job,
    purge_expired,
    stamp_owner,
)
from app.policy import freeze_policy, score_job, score_policy
from app.schemas import ImpactBody, JobCreate, ScoreBody
from app.tables import read_csv

router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


def job_public(job: Job) -> dict:
    result = json.loads(job.result_json) if job.result_json else None
    return {
        "id": job.id,
        "dataset_id": job.dataset_id,
        "label": job.label,
        "status": job.status,
        "error": job.error,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "result": result,
    }


@router.post("", status_code=202)
def create_job(
    body: JobCreate,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    purge_expired(session)
    abandon_orphaned_jobs(session)
    if active_job_count(session, ident) >= settings.max_active_jobs:
        raise HTTPException(429, "A search is already running for you. Wait for it to finish.")
    ds = get_owned_dataset(session, ident, body.dataset_id)
    if ds is None:
        raise HTTPException(404, "Unknown dataset.")
    jid = secrets.token_hex(6)
    job = Job(
        id=jid,
        dataset_id=ds.id,
        label=body.label,
        status="queued",
        search_document=body.label,
        **stamp_owner(ident),
    )
    session.add(job)
    session.commit()
    threading.Thread(target=run_job, args=(jid,), daemon=True).start()
    return {"id": jid, "dataset_id": ds.id, "label": body.label, "status": "queued"}


@router.get("/{job_id}")
def get_job(job_id: str, session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    job = get_owned_job(session, ident, job_id)
    if job is None:
        raise HTTPException(404, "Unknown job.")
    return job_public(job)


@router.post("/{job_id}/score")
def score_from_job(
    job_id: str,
    body: ScoreBody,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    job = get_owned_job(session, ident, job_id)
    if job is None:
        raise HTTPException(404, "Unknown job.")
    if job.status != "succeeded" or not job.result_json:
        raise HTTPException(409, "Job has not finished compiling.")
    return score_job(json.loads(job.result_json), body.row, body.tree_id, body.banned, body.keep)


@router.post("/{job_id}/impact")
def preview_impact(
    job_id: str,
    body: ImpactBody,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    """Run the chosen rule over the original file: prediction rates overall and per group."""
    job = get_owned_job(session, ident, job_id)
    if job is None:
        raise HTTPException(404, "Unknown job.")
    if job.status != "succeeded" or not job.result_json:
        raise HTTPException(409, "Job has not finished compiling.")
    result = json.loads(job.result_json)
    policy = freeze_policy(result, body.tree_id, body.banned, body.keep)
    policy["ensemble"] = [policy["tree"]]
    ds = session.get(Dataset, job.dataset_id)
    if ds is None:
        raise HTTPException(404, "The original file was deleted, so impact cannot be previewed.")

    df = read_csv(ds.csv_bytes)
    cols = policy["maps"]["columns"]
    group_col = body.group_by if body.group_by in df.columns else ""
    overall: dict[str, int] = {}
    groups: dict[str, dict[str, int]] = {}
    records = df.head(settings.max_rows).to_dict(orient="records")
    for rec in records:
        vals = {c: "" if rec.get(c) is None else str(rec.get(c)) for c in cols}
        pred = score_policy(policy, vals)["prediction"]
        overall[pred] = overall.get(pred, 0) + 1
        if group_col:
            bucket = groups.setdefault(str(rec.get(group_col)), {})
            bucket[pred] = bucket.get(pred, 0) + 1
    return {
        "n": len(records),
        "label": result.get("label"),
        "class_names": result.get("class_names") or [],
        "overall": overall,
        "group_by": group_col or None,
        "groups": [
            {"value": value, "n": sum(counts.values()), "counts": counts}
            for value, counts in sorted(groups.items())
        ],
    }
