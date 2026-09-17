"""Background PRAXIS compile for a queued job."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlmodel import Session as DBSession

from app import cancel, fit_cache
from app.db import engine
from app.fit import compile_table
from app.fit_params import normalize_fit_params
from app.models import Dataset, Job
from app.tables import read_csv


def run_job(job_id: str) -> None:
    if cancel.is_cancelled(job_id):
        cancel.clear_cancelled(job_id)
        return

    # Load inputs and mark running, then CLOSE the session before the long fit
    # so Delete my data is not blocked on SQLite.
    with DBSession(engine) as session:
        job = session.get(Job, job_id)
        if job is None:
            cancel.clear_cancelled(job_id)
            return
        label = job.label
        dataset_id = job.dataset_id
        try:
            raw_params = json.loads(job.params_json or "{}")
        except (TypeError, ValueError):
            raw_params = {}
        job.status = "running"
        session.add(job)
        session.commit()
        ds = session.get(Dataset, dataset_id)
        if ds is None:
            job.status = "failed"
            job.error = "Dataset disappeared before the job ran."
            job.finished_at = datetime.now(timezone.utc)
            session.add(job)
            session.commit()
            cancel.clear_cancelled(job_id)
            return
        csv_bytes = ds.csv_bytes

    if cancel.is_cancelled(job_id):
        fit_cache.pop(job_id)
        cancel.clear_cancelled(job_id)
        return

    try:
        df = read_csv(csv_bytes)
        params = normalize_fit_params(raw_params)
        result, bundle = compile_table(df, label, **params.as_compile_kwargs())
    except Exception as exc:
        fit_cache.pop(job_id)
        if cancel.is_cancelled(job_id):
            cancel.clear_cancelled(job_id)
            return
        with DBSession(engine) as session:
            job = session.get(Job, job_id)
            if job is None:
                cancel.clear_cancelled(job_id)
                return
            job.status = "failed"
            job.error = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            session.add(job)
            session.commit()
        cancel.clear_cancelled(job_id)
        return

    if cancel.is_cancelled(job_id):
        fit_cache.pop(job_id)
        try:
            from app.bases_store import drop as drop_bases

            drop_bases(job_id)
        except Exception:
            pass
        cancel.clear_cancelled(job_id)
        return

    fit_cache.put(job_id, bundle)
    from app.bases_store import save_bundle

    save_bundle(job_id, bundle)

    if cancel.is_cancelled(job_id):
        fit_cache.pop(job_id)
        try:
            from app.bases_store import drop as drop_bases

            drop_bases(job_id)
        except Exception:
            pass
        cancel.clear_cancelled(job_id)
        return

    with DBSession(engine) as session:
        job = session.get(Job, job_id)
        if job is None or cancel.is_cancelled(job_id):
            fit_cache.pop(job_id)
            try:
                from app.bases_store import drop as drop_bases

                drop_bases(job_id)
            except Exception:
                pass
            cancel.clear_cancelled(job_id)
            return
        job.status = "succeeded"
        job.result_json = json.dumps(result)
        job.search_document = label
        job.error = None
        job.finished_at = datetime.now(timezone.utc)
        session.add(job)
        session.commit()
    cancel.clear_cancelled(job_id)
