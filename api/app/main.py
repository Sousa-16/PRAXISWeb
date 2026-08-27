from __future__ import annotations

import json
import secrets
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.auth import COOKIE, Identity, read_identity
from app.config import sample_csv, settings
from app.db import engine, get_session, init_db
from app.models import Dataset, Job, Policy
from app.owners import (
    abandon_orphaned_jobs,
    active_job_count,
    attach_guest_to_user,
    get_owned_dataset,
    get_owned_job,
    get_owned_policy,
    purge_expired,
    stamp_owner,
    wipe_identity,
)
from app.policy import freeze_policy, score_job, score_policy, search_blob
from app.search import search_owned
from app.timbertrek_export import build_timbertrek_doc, clamp_export_cap

try:
    import sentry_sdk
except ImportError:
    sentry_sdk = None


def _before_send(event, _hint):
    req = event.get("request") or {}
    req.pop("data", None)
    headers = req.get("headers") or {}
    for key in list(headers):
        if key.lower() in {"authorization", "cookie"}:
            headers.pop(key, None)
    event["request"] = req
    return event


if settings.sentry_dsn and sentry_sdk is not None:
    sentry_sdk.init(dsn=settings.sentry_dsn, before_send=_before_send, send_default_pii=False)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with Session(engine) as session:
        abandon_orphaned_jobs(session)
    yield


app = FastAPI(
    title="PRAXIS Web",
    version="0.2.0",
    description=(
        "Policy workshop API. PRAXIS enumerates near-optimal trees; this service "
        "did not author that enumerator. Fit is a job. Score walks frozen JSON. "
        "Next.js on Vercel should call this Python host; do not run PRAXIS on Vercel."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def session_and_purge(request: Request, call_next):
    ident = read_identity(request)
    request.state.identity = ident
    response: Response = await call_next(request)
    if ident.new_cookie:
        response.set_cookie(
            COOKIE,
            ident.session_id,
            httponly=True,
            samesite="lax",
            secure=settings.cookie_secure,
            max_age=30 * 24 * 3600,
            path="/",
        )
    return response


def identity_dep(request: Request) -> Identity:
    return request.state.identity


def set_cookie(response: Response, ident: Identity) -> None:
    if ident.new_cookie:
        response.set_cookie(
            COOKIE,
            ident.session_id,
            httponly=True,
            samesite="lax",
            secure=settings.cookie_secure,
            max_age=30 * 24 * 3600,
            path="/",
        )


class JobCreate(BaseModel):
    dataset_id: str
    label: str


class ScoreBody(BaseModel):
    row: dict[str, Any] = Field(default_factory=dict)
    tree_id: int = 0
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)


class PolicyCreate(BaseModel):
    job_id: str
    tree_id: int
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)
    name: str = ""
    notes: str = ""


class PolicyScoreBody(BaseModel):
    row: dict[str, Any] = Field(default_factory=dict)


class ImpactBody(BaseModel):
    tree_id: int = 0
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)
    group_by: str = ""


class ProfileBody(BaseModel):
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)
    max_trees: int | None = None


class TimberTrekExportBody(BaseModel):
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)
    # Optional higher cap for browse export (TimberTrek-friendly; max 5000).
    max_trees: int | None = None
    # If true and the model is still in memory, expand profile for this download only.
    expand: bool = False
    # Exact PRAXIS tree ids from Set Tree Rules (profiled leftover). Ignored when expand=True.
    tree_ids: list[int] | None = None
    # Walk best-objective order with no column filter (Set Tree Rules browse export).
    best_objective: bool = False


class MatchCountBody(BaseModel):
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)


@app.exception_handler(ValueError)
async def value_error(_, exc: ValueError):
    return JSONResponse({"error": str(exc)}, status_code=400)


@app.exception_handler(HTTPException)
async def http_exc(_, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse({"error": detail}, status_code=exc.status_code)


@app.exception_handler(Exception)
async def any_exc(_, exc: Exception):
    if isinstance(exc, HTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse({"error": detail}, status_code=exc.status_code)
    return JSONResponse({"error": str(exc) or exc.__class__.__name__}, status_code=500)


@app.get("/health")
def health():
    from sqlalchemy import text

    from app import bases_store
    from app.job_queue import redis_ok

    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    storage_ok = bases_store.storage_ok()
    redis_status = redis_ok()
    ready = db_ok and storage_ok and (redis_status is not False)
    return {
        "ok": ready,
        "auth": bool(settings.supabase_jwt_secret),
        "database": db_ok,
        "storage": storage_ok,
        "storage_backend": "s3" if settings.uses_s3_storage() else "local",
        "job_queue": "redis" if settings.uses_job_queue() else "thread",
        "redis": redis_status,
    }


@app.get("/v1/me")
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


@app.post("/v1/auth/attach")
def attach(session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    if not ident.user_id:
        raise HTTPException(401, "Sign in first.")
    n = attach_guest_to_user(session, ident)
    return {"attached": n}


@app.delete("/v1/me/data")
def delete_mine(session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    wipe_identity(session, ident)
    return {"ok": True}


def _store_dataset(session: Session, ident: Identity, filename: str, raw: bytes) -> dict:
    purge_expired(session)
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(413, "File is too large (20 MB max).")
    from app.tables import preview_frame, read_csv

    df = read_csv(raw)
    if len(df) > settings.max_rows:
        raise HTTPException(400, f"This demo accepts at most {settings.max_rows} rows.")
    preview = preview_frame(df)
    did = secrets.token_hex(6)
    row = Dataset(id=did, filename=filename, csv_bytes=raw, preview_json=json.dumps(preview), **stamp_owner(ident))
    session.add(row)
    session.commit()
    return {"id": did, "filename": filename, **preview}


@app.post("/v1/datasets", status_code=201)
async def create_dataset(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    raw = await file.read()
    return _store_dataset(session, ident, file.filename or "upload.csv", raw)


@app.post("/v1/datasets/sample", status_code=201)
def create_sample(session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    path = sample_csv()
    if not path.is_file():
        raise HTTPException(500, f"Sample table is missing at {path}. Restart the API from WebApp/api.")
    raw = path.read_bytes()
    return _store_dataset(session, ident, "spambase.csv", raw)


@app.post("/v1/jobs", status_code=202)
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
    from app.job_queue import enqueue_job

    enqueue_job(jid)
    return {"id": jid, "dataset_id": ds.id, "label": body.label, "status": "queued"}


def _job_public(job: Job) -> dict:
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


@app.get("/v1/jobs/{job_id}")
def get_job(job_id: str, session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    job = get_owned_job(session, ident, job_id)
    if job is None:
        raise HTTPException(404, "Unknown job.")
    return _job_public(job)


@app.post("/v1/jobs/{job_id}/profile")
def profile_job(
    job_id: str,
    body: ProfileBody,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    """After column choices: walk best-objective trees and fully profile up to 2000 matches."""
    from app import fit_cache
    from app.fit import profile_for_constraints

    job = get_owned_job(session, ident, job_id)
    if job is None:
        raise HTTPException(404, "Unknown job.")
    if job.status != "succeeded" or not job.result_json:
        raise HTTPException(409, "Job has not finished compiling.")
    bundle = fit_cache.get(job_id)
    if bundle is None:
        raise HTTPException(
            409,
            "The fitted model is no longer in memory (API restarted). Run Find good rules again.",
        )
    try:
        result = profile_for_constraints(bundle, body.banned, body.keep, body.max_trees)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    job.result_json = json.dumps(result)
    job.search_document = search_blob(result, None)
    session.add(job)
    session.commit()
    return result


@app.post("/v1/jobs/{job_id}/match_count")
def match_count_job(
    job_id: str,
    body: MatchCountBody,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    """Live surviving-tree count for column toggles (uses in-memory or disk bases index)."""
    from app import bases_store, fit_cache
    from app.fit import count_matching

    job = get_owned_job(session, ident, job_id)
    if job is None:
        raise HTTPException(404, "Unknown job.")
    if job.status != "succeeded" or not job.result_json:
        raise HTTPException(409, "Job has not finished compiling.")
    bundle = fit_cache.get(job_id)
    if bundle is not None:
        return count_matching(bundle, body.banned, body.keep)
    loaded = bases_store.load(job_id)
    if loaded is not None:
        feature_bit, bits = loaded
        return bases_store.count_bits(bits, feature_bit, body.banned, body.keep)
    raise HTTPException(
        409,
        "The fitted model is no longer in memory (API restarted). Run Find good rules again.",
    )


@app.post("/v1/jobs/{job_id}/timbertrek")
def export_timbertrek(
    job_id: str,
    body: TimberTrekExportBody,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    """Download TimberTrek HierarchyJSON for exploring the set (not for shipping)."""
    from app import fit_cache
    from app.fit import profile_for_constraints

    job = get_owned_job(session, ident, job_id)
    if job is None:
        raise HTTPException(404, "Unknown job.")
    if job.status != "succeeded" or not job.result_json:
        raise HTTPException(409, "Job has not finished compiling.")

    stored = json.loads(job.result_json)
    cap = clamp_export_cap(body.max_trees)
    banned = body.banned
    keep = body.keep
    trees_source = stored

    if body.best_objective or body.expand:
        bundle = fit_cache.get(job_id)
        if bundle is None:
            raise HTTPException(
                409,
                "Cannot expand export: fitted model is no longer in memory. "
                "Download the currently profiled trees, or run Find good rules again.",
            )
        try:
            walk_banned = [] if body.best_objective else banned
            walk_keep = [] if body.best_objective else keep
            trees_source = profile_for_constraints(bundle, walk_banned, walk_keep, cap)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    elif not stored.get("trees"):
        raise HTTPException(409, "Profile matching trees after choosing columns first.")
    else:
        # Prefer the exact Set Tree Rules leftover (tree_ids); else filter by column choices.
        from app.constraints import remaining_trees

        profiled = stored.get("trees") or []
        if body.tree_ids:
            by_id = {int(t["id"]): t for t in profiled if t.get("id") is not None}
            filtered = []
            seen: set[int] = set()
            for raw in body.tree_ids:
                tid = int(raw)
                if tid in seen:
                    continue
                seen.add(tid)
                tree = by_id.get(tid)
                if tree is not None:
                    filtered.append(tree)
            filtered = remaining_trees(filtered, banned, keep)[:cap]
        else:
            filtered = remaining_trees(profiled, banned, keep)[:cap]
        if not filtered:
            raise HTTPException(400, "No profiled rule survives these column choices.")
        trees_source = dict(stored)
        trees_source["trees"] = filtered
        trees_source["constraints"] = {"banned": banned, "keep": keep}

    bundle = fit_cache.get(job_id)
    xy = {}
    if bundle is not None:
        xy = {"bin_names": bundle.bin_names, "Xb": bundle.Xb_te, "y": bundle.y_te}
    doc = build_timbertrek_doc(trees_source, banned=banned, keep=keep, **xy)
    n_praxis = int(stored.get("n_trees") or 0)
    n_exported = len(doc.get("treeMap") or {})
    payload = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    return Response(
        content=payload,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="timbertrek_{job_id}.json"',
            "X-PRAXIS-N-Trees": str(n_praxis),
            "X-PRAXIS-N-Exported": str(n_exported),
        },
    )


@app.post("/v1/jobs/{job_id}/score")
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
    result = json.loads(job.result_json)
    if not result.get("trees"):
        raise HTTPException(409, "Profile matching trees after choosing columns first.")
    return score_job(result, body.row, body.tree_id, body.banned, body.keep)


@app.post("/v1/jobs/{job_id}/impact")
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
    if not result.get("trees"):
        raise HTTPException(409, "Profile matching trees after choosing columns first.")
    policy = freeze_policy(result, body.tree_id, body.banned, body.keep)
    # Agreement across the ensemble is not needed here; score the single tree.
    policy["ensemble"] = [policy["tree"]]
    ds = session.get(Dataset, job.dataset_id)
    if ds is None:
        raise HTTPException(404, "The original file was deleted, so impact cannot be previewed.")
    from app.tables import read_csv

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


@app.post("/v1/policies", status_code=201)
def create_policy(
    body: PolicyCreate,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    job = get_owned_job(session, ident, body.job_id)
    if job is None:
        raise HTTPException(404, "Unknown job.")
    if job.status != "succeeded" or not job.result_json:
        raise HTTPException(409, "Job has not finished compiling.")
    result = json.loads(job.result_json)
    if not result.get("trees"):
        raise HTTPException(409, "Profile matching trees after choosing columns first.")
    policy = freeze_policy(result, body.tree_id, body.banned, body.keep)
    pid = secrets.token_hex(6)
    policy["id"] = pid
    name = body.name.strip()[:120]
    notes = body.notes.strip()[:2000]
    if name:
        policy["name"] = name
    if notes:
        policy["notes"] = notes
    row = Policy(
        id=pid,
        job_id=job.id,
        tree_id=int(body.tree_id),
        constraints_json=json.dumps({"banned": body.banned, "keep": body.keep}),
        policy_json=json.dumps(policy),
        search_document=" ".join(filter(None, [search_blob(result, policy), name, notes])),
        **stamp_owner(ident),
    )
    session.add(row)
    session.commit()
    return policy


@app.get("/v1/policies/{policy_id}")
def get_policy(policy_id: str, session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    row = get_owned_policy(session, ident, policy_id)
    if row is None:
        raise HTTPException(404, "Unknown policy.")
    return json.loads(row.policy_json)


@app.post("/v1/policies/{policy_id}/score")
def score_saved(
    policy_id: str,
    body: PolicyScoreBody,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    row = get_owned_policy(session, ident, policy_id)
    if row is None:
        raise HTTPException(404, "Unknown policy.")
    return score_policy(json.loads(row.policy_json), body.row)


@app.post("/v1/policies/{policy_id}/score_batch")
async def score_saved_batch(
    policy_id: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    """Score every row of an uploaded CSV; return the CSV with decision columns added."""
    stored = get_owned_policy(session, ident, policy_id)
    if stored is None:
        raise HTTPException(404, "Unknown policy.")
    policy = json.loads(stored.policy_json)
    raw = await file.read()
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(413, "File is too large (20 MB max).")
    from app.tables import read_csv

    df = read_csv(raw)
    if len(df) > settings.max_rows:
        raise HTTPException(400, f"This demo scores at most {settings.max_rows} rows at once.")
    cols = policy["maps"]["columns"]
    preds: list[str] = []
    agrees: list[str] = []
    reasons: list[str] = []
    for rec in df.to_dict(orient="records"):
        vals = {c: "" if rec.get(c) is None else str(rec.get(c)) for c in cols}
        out = score_policy(policy, vals)
        preds.append(out["prediction"])
        agrees.append(f"{out['agree']}/{out['n']}")
        reasons.append("; ".join(out.get("reason") or []))
    scored = df.copy()
    scored["prediction"] = preds
    scored["rules_agree"] = agrees
    scored["reason"] = reasons
    return Response(
        content=scored.to_csv(index=False),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="scored_{policy_id}.csv"'},
    )


@app.get("/v1/search")
def search(q: str = "", session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    return search_owned(session, ident, q)

