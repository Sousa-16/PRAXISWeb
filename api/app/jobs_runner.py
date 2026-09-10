"""Background PRAXIS compile for a queued job."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlmodel import Session as DBSession

from app import fit_cache
from app.db import engine
from app.fit import compile_table
from app.models import Dataset, Job
from app.policy import search_blob
from app.tables import read_csv


def run_job(job_id: str) -> None:
    with DBSession(engine) as session:
        job = session.get(Job, job_id)
        if job is None:
            return
        job.status = "running"
        session.add(job)
        session.commit()
        try:
            ds = session.get(Dataset, job.dataset_id)
            if ds is None:
                raise ValueError("Dataset disappeared before the job ran.")
            df = read_csv(ds.csv_bytes)
            result, bundle = compile_table(df, job.label)
            fit_cache.put(job_id, bundle)
            from app.bases_store import save_bundle

            save_bundle(job_id, bundle)
            # Full tree profiles wait until Browse (profileAndContinue). Fit only stores
            # the shell + NPZ bases index so Set Tree Rules match counts stay cheap.
            job.status = "succeeded"
            job.result_json = json.dumps(result)
            job.search_document = search_blob(result, None)
            job.error = None
            job.finished_at = datetime.now(timezone.utc)
        except Exception as exc:
            fit_cache.pop(job_id)
            job.status = "failed"
            job.error = str(exc)
            job.finished_at = datetime.now(timezone.utc)
        session.add(job)
        session.commit()
