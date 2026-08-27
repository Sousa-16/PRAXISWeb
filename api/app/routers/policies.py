from __future__ import annotations

import json
import secrets

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlmodel import Session

from app.auth import Identity
from app.config import settings
from app.db import get_session
from app.deps import identity_dep
from app.models import Policy
from app.owners import get_owned_job, get_owned_policy, stamp_owner
from app.policy import freeze_policy, score_policy, search_blob
from app.schemas import PolicyCreate, PolicyScoreBody
from app.tables import read_csv

router = APIRouter(prefix="/v1/policies", tags=["policies"])


@router.post("", status_code=201)
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


@router.get("/{policy_id}")
def get_policy(policy_id: str, session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    row = get_owned_policy(session, ident, policy_id)
    if row is None:
        raise HTTPException(404, "Unknown policy.")
    return json.loads(row.policy_json)


@router.post("/{policy_id}/score")
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


@router.post("/{policy_id}/score_batch")
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
