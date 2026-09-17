from __future__ import annotations

import json
import secrets
import threading
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.auth import COOKIE, Identity, read_identity
from app.config import sample_csv, settings
from app.db import engine, get_session, init_db
from app.models import Dataset, Job
from app.owners import (
    abandon_orphaned_jobs,
    active_job_count,
    get_owned_dataset,
    get_owned_job,
    global_active_job_count,
    purge_expired,
    stamp_owner,
    wipe_identity,
)
from app.policy import freeze_policy, score_job, score_policy
from app.fit_params import fit_params_public_meta, normalize_fit_params
from app.rate_limit import check_session_and_ip
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


def _purge_loop() -> None:
    import logging

    log = logging.getLogger("praxis.purge")
    while True:
        time.sleep(900)
        try:
            with Session(engine) as session:
                purge_expired(session)
        except Exception:
            log.exception("Guest purge failed")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app import fit_cache

    init_db()
    with Session(engine) as session:
        abandon_orphaned_jobs(session)
        purge_expired(session)
    fit_cache.warm_from_disk()
    threading.Thread(target=_purge_loop, daemon=True, name="praxis-purge").start()
    yield


app = FastAPI(
    title="PRAXIS Web",
    version="0.2.0",
    description=(
        "Workshop API. PRAXIS enumerates near-optimal trees; this service "
        "did not author that enumerator. Fit is a job. Score walks a frozen rule. "
        "Next.js on Vercel should call this Python host; do not run PRAXIS on Vercel."
    ),
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cookie_max_age() -> int:
    hours = max(1, int(settings.guest_ttl_hours or 24))
    return hours * 3600


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
            max_age=_cookie_max_age(),
            path="/",
        )
    return response


def identity_dep(request: Request) -> Identity:
    return request.state.identity


class JobCreate(BaseModel):
    dataset_id: str
    label: str
    params: dict[str, Any] | None = None


class ScoreBody(BaseModel):
    row: dict[str, Any] = Field(default_factory=dict)
    tree_id: int = 0
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)


class FreezeBody(BaseModel):
    tree_id: int = 0
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)


class ImpactBody(BaseModel):
    tree_id: int = 0
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)
    group_by: str = ""


def _succeeded_job_result(session: Session, ident: Identity, job_id: str) -> tuple[Job, dict[str, Any]]:
    job = get_owned_job(session, ident, job_id)
    if job is None:
        raise HTTPException(404, "Unknown job.")
    if job.status != "succeeded" or not job.result_json:
        raise HTTPException(409, "Job has not finished compiling.")
    result = json.loads(job.result_json)
    if not result.get("trees"):
        raise HTTPException(409, "Profile matching trees after choosing columns first.")
    return job, result


def _parse_str_list(raw: str, field: str) -> list[str]:
    try:
        data = json.loads(raw or "[]")
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"Invalid {field} JSON.") from exc
    if not isinstance(data, list) or not all(isinstance(x, str) for x in data):
        raise HTTPException(400, f"{field} must be a JSON array of strings.")
    return data


class ProfileBody(BaseModel):
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)
    max_trees: int | None = None


class TimberTrekExportBody(BaseModel):
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)
    # Optional cap for browse export (clamped to 2000).
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
    import logging

    logging.getLogger("praxis.api").exception("Unhandled error: %s", exc.__class__.__name__)
    return JSONResponse(
        {"error": "Something went wrong on the server. Try again in a moment."},
        status_code=500,
    )


@app.get("/health")
def health():
    from sqlalchemy import text

    from app import bases_store

    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    storage_ok = bases_store.storage_ok()
    ready = db_ok and storage_ok
    return {
        "ok": ready,
        "database": db_ok,
        "storage": storage_ok,
        "storage_backend": "s3" if settings.uses_s3_storage() else "local",
        "job_queue": "thread",
        "max_rows": settings.max_rows,
        "max_upload_bytes": settings.max_upload_bytes,
        "max_global_jobs": settings.max_global_jobs,
        "guest_ttl_hours": settings.guest_ttl_hours,
        "fit_params": fit_params_public_meta(),
    }


@app.get("/v1/me")
def me(ident: Identity = Depends(identity_dep)):
    return {
        "session_id": ident.session_id[:6] + "…",
        "guest_ttl_hours": settings.guest_ttl_hours,
        "max_rows": settings.max_rows,
        "max_upload_bytes": settings.max_upload_bytes,
        "fit_params": fit_params_public_meta(),
        "notice": (
            "Other visitors cannot open your uploads. They are tied to this browser. "
            f"Guest data is deleted after {settings.guest_ttl_hours} hours. "
            "The server and data host can still access stored rows. "
            "Do not upload secrets on the web app. "
            "Instead download PRAXIS Web locally."
        ),
    }


@app.delete("/v1/me/data")
def delete_mine(
    response: Response,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    wipe_identity(session, ident)
    # Rotate the guest cookie so a wiped browser is a fresh session.
    new_sid = secrets.token_urlsafe(24)
    response.set_cookie(
        COOKIE,
        new_sid,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=_cookie_max_age(),
        path="/",
    )
    return {"ok": True}


def _client_ip(request: Request) -> str:
    """Visitor IP for rate limits.

    When PRAXIS_PROXY_SECRET is set, trust X-Praxis-Client-Ip only if the
    request also carries that secret (Vercel rewrite). Otherwise use the
    direct peer (Caddy → API on localhost), not raw X-Forwarded-For.
    """
    secret = settings.proxy_secret
    if secret:
        provided = request.headers.get("x-praxis-proxy-secret", "")
        if provided and secrets.compare_digest(provided, secret):
            client = (request.headers.get("x-praxis-client-ip") or "").strip()
            if client:
                return client.split(",", 1)[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def _limit(ident: Identity, request: Request, action: str, *, limit: int, window_s: float, ip_limit: int | None = None) -> None:
    check_session_and_ip(ident.session_id, _client_ip(request), action, limit=limit, window_s=window_s, ip_limit=ip_limit)


def _row_vals(rec: dict[str, Any], cols: list[str]) -> dict[str, str]:
    return {c: "" if rec.get(c) is None else str(rec.get(c)) for c in cols}


def _reject_oversize(raw: bytes) -> None:
    if len(raw) > settings.max_upload_bytes:
        mb = max(1, settings.max_upload_bytes // (1024 * 1024))
        raise HTTPException(413, f"File is too large ({mb} MB max).")


def _store_dataset(session: Session, ident: Identity, filename: str, raw: bytes, request: Request) -> dict:
    purge_expired(session)
    _reject_oversize(raw)
    if not raw.strip():
        raise HTTPException(400, "The uploaded CSV is empty.")
    _limit(ident, request, "upload", limit=4, window_s=60.0)
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
    request: Request,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    raw = await file.read()
    return _store_dataset(session, ident, file.filename or "upload.csv", raw, request)


@app.post("/v1/datasets/sample", status_code=201)
def create_sample(
    request: Request,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    path = sample_csv()
    if not path.is_file():
        raise HTTPException(500, f"Sample table is missing at {path}. Restart the API from WebApp/api.")
    raw = path.read_bytes()
    return _store_dataset(session, ident, "spambase.csv", raw, request)


@app.post("/v1/jobs", status_code=202)
def create_job(
    request: Request,
    body: JobCreate,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    purge_expired(session)
    abandon_orphaned_jobs(session)
    _limit(ident, request, "create_job", limit=3, window_s=300.0)
    if active_job_count(session, ident) >= settings.max_active_jobs:
        raise HTTPException(429, "A search is already running for you. Wait for it to finish.")
    if global_active_job_count(session) >= settings.max_global_jobs:
        raise HTTPException(429, "The demo is busy compiling another search. Try again in a minute.")
    ds = get_owned_dataset(session, ident, body.dataset_id)
    if ds is None:
        raise HTTPException(404, "Unknown dataset.")
    try:
        params = normalize_fit_params(body.params)
    except Exception as exc:
        raise HTTPException(400, f"Invalid search settings: {exc}") from exc
    jid = secrets.token_hex(6)
    job = Job(
        id=jid,
        dataset_id=ds.id,
        label=body.label,
        status="queued",
        search_document=body.label,
        params_json=json.dumps(params.as_compile_kwargs()),
        **stamp_owner(ident),
    )
    session.add(job)
    session.commit()
    from app.job_queue import enqueue_job

    enqueue_job(jid)
    return {
        "id": jid,
        "dataset_id": ds.id,
        "label": body.label,
        "status": "queued",
        "params": params.as_compile_kwargs(),
    }


def _job_public(job: Job) -> dict:
    result = json.loads(job.result_json) if job.result_json else None
    try:
        params = json.loads(job.params_json or "{}")
    except (TypeError, ValueError):
        params = {}
    if not params:
        params = None
    return {
        "id": job.id,
        "dataset_id": job.dataset_id,
        "label": job.label,
        "status": job.status,
        "error": job.error,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "result": result,
        "params": params,
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
    request: Request,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    """After column choices: walk best-objective trees and fully profile up to 2000 matches."""
    from app import fit_cache
    from app.fit import profile_for_constraints

    _limit(ident, request, "profile", limit=8, window_s=60.0)
    job = get_owned_job(session, ident, job_id)
    if job is None:
        raise HTTPException(404, "Unknown job.")
    if job.status != "succeeded" or not job.result_json:
        raise HTTPException(409, "Job has not finished compiling.")
    max_trees = body.max_trees
    if max_trees is None:
        try:
            stored_params = json.loads(job.params_json or "{}")
            if stored_params.get("max_trees") is not None:
                max_trees = int(stored_params["max_trees"])
        except (TypeError, ValueError):
            max_trees = None
    if max_trees is not None:
        max_trees = max(50, min(2000, int(max_trees)))
    bundle = fit_cache.get(job_id)
    if bundle is None:
        stored = json.loads(job.result_json)
        cons = stored.get("constraints") or {}
        same = (
            list(cons.get("banned") or []) == list(body.banned or [])
            and list(cons.get("keep") or []) == list(body.keep or [])
        )
        if same and stored.get("profiled") and stored.get("trees"):
            return stored
        raise HTTPException(
            409,
            "The fitted model is no longer in memory (API restarted). "
            "Browse the last saved profile, or run Find good rules again to change column rules.",
        )
    try:
        result = profile_for_constraints(bundle, body.banned, body.keep, max_trees)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    job.result_json = json.dumps(result)
    job.search_document = job.label
    session.add(job)
    session.commit()
    return result


@app.post("/v1/jobs/{job_id}/match_count")
def match_count_job(
    job_id: str,
    body: MatchCountBody,
    request: Request,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    """Live surviving-tree count for column toggles (uses in-memory or disk bases index)."""
    from app import bases_store, fit_cache
    from app.fit import count_matching

    _limit(ident, request, "match_count", limit=40, window_s=60.0)
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
    request: Request,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    """Download TimberTrek HierarchyJSON for exploring the set (not for shipping)."""
    from app import fit_cache
    from app.fit import profile_for_constraints

    _limit(ident, request, "timbertrek", limit=4, window_s=120.0)
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
    _, result = _succeeded_job_result(session, ident, job_id)
    return score_job(result, body.row, body.tree_id, body.banned, body.keep)


@app.post("/v1/jobs/{job_id}/freeze")
def freeze_from_job(
    job_id: str,
    body: FreezeBody,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    """Return a frozen rule JSON for download / offline scoring (not persisted)."""
    _, result = _succeeded_job_result(session, ident, job_id)
    return freeze_policy(result, body.tree_id, body.banned, body.keep)


@app.post("/v1/jobs/{job_id}/score_batch")
async def score_job_batch(
    request: Request,
    job_id: str,
    file: UploadFile = File(...),
    tree_id: int = Form(0),
    banned: str = Form("[]"),
    keep: str = Form("[]"),
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    """Score every row of an uploaded CSV; return the CSV with decision columns added."""
    _limit(ident, request, "score_batch", limit=4, window_s=120.0)
    _, result = _succeeded_job_result(session, ident, job_id)
    policy = freeze_policy(result, tree_id, _parse_str_list(banned, "banned"), _parse_str_list(keep, "keep"))
    raw = await file.read()
    _reject_oversize(raw)
    from app.tables import read_csv

    df = read_csv(raw)
    if len(df) > settings.max_rows:
        raise HTTPException(400, f"This demo scores at most {settings.max_rows} rows at once.")
    cols = policy["maps"]["columns"]
    preds: list[str] = []
    agrees: list[str] = []
    reasons: list[str] = []
    for rec in df.to_dict(orient="records"):
        vals = _row_vals(rec, cols)
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
        headers={"Content-Disposition": f'attachment; filename="scored_{job_id}.csv"'},
    )


@app.post("/v1/jobs/{job_id}/impact")
def preview_impact(
    job_id: str,
    body: ImpactBody,
    request: Request,
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    """Run the chosen rule over the original file: prediction rates overall and per group."""
    _limit(ident, request, "impact", limit=8, window_s=60.0)
    job, result = _succeeded_job_result(session, ident, job_id)
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
        vals = _row_vals(rec, cols)
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

