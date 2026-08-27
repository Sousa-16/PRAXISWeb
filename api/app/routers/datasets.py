from __future__ import annotations

import json
import secrets

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session

from app.auth import Identity
from app.config import sample_csv, settings
from app.db import get_session
from app.deps import identity_dep
from app.models import Dataset
from app.owners import purge_expired, stamp_owner
from app.tables import preview_frame, read_csv

router = APIRouter(prefix="/v1/datasets", tags=["datasets"])


def store_dataset(session: Session, ident: Identity, filename: str, raw: bytes) -> dict:
    purge_expired(session)
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(413, "File is too large (20 MB max).")
    df = read_csv(raw)
    if len(df) > settings.max_rows:
        raise HTTPException(400, f"This demo accepts at most {settings.max_rows} rows.")
    preview = preview_frame(df)
    did = secrets.token_hex(6)
    row = Dataset(
        id=did,
        filename=filename,
        csv_bytes=raw,
        preview_json=json.dumps(preview),
        **stamp_owner(ident),
    )
    session.add(row)
    session.commit()
    return {"id": did, "filename": filename, **preview}


@router.post("", status_code=201)
async def create_dataset(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    ident: Identity = Depends(identity_dep),
):
    raw = await file.read()
    return store_dataset(session, ident, file.filename or "upload.csv", raw)


@router.post("/sample", status_code=201)
def create_sample(session: Session = Depends(get_session), ident: Identity = Depends(identity_dep)):
    path = sample_csv()
    if not path.is_file():
        raise HTTPException(500, f"Sample table is missing at {path}. Restart the API from WebApp/api.")
    return store_dataset(session, ident, "spambase.csv", path.read_bytes())
