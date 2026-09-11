"""S3-compatible object storage for bases cache (AWS S3, MinIO, or similar)."""

from __future__ import annotations

import io
from functools import lru_cache

from app.config import settings


@lru_cache(maxsize=1)
def _client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4"),
    )


def _key(job_id: str) -> str:
    prefix = settings.s3_prefix
    return f"{prefix}/{job_id}.npz" if prefix else f"{job_id}.npz"


def s3_get(job_id: str) -> bytes | None:
    from botocore.exceptions import ClientError

    client = _client()
    try:
        resp = client.get_object(Bucket=settings.s3_bucket, Key=_key(job_id))
        return resp["Body"].read()
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in {"NoSuchKey", "404", "NotFound"}:
            return None
        raise


def s3_put(job_id: str, data: bytes) -> None:
    client = _client()
    client.put_object(Bucket=settings.s3_bucket, Key=_key(job_id), Body=data)


def s3_delete(job_id: str) -> None:
    client = _client()
    client.delete_object(Bucket=settings.s3_bucket, Key=_key(job_id))


def s3_ping() -> bool:
    client = _client()
    client.head_bucket(Bucket=settings.s3_bucket)
    return True


def pack_npz(feature_bit: dict[str, int], bases_bits) -> bytes:
    import numpy as np

    names: list[str | None] = [None] * len(feature_bit)
    for name, idx in feature_bit.items():
        names[idx] = name
    buf = io.BytesIO()
    np.savez_compressed(
        buf,
        bits=np.asarray(bases_bits, dtype=np.uint64),
        names=np.array(names, dtype=object),
    )
    return buf.getvalue()


def unpack_npz(data: bytes):
    import io

    import numpy as np

    data_np = np.load(io.BytesIO(data), allow_pickle=True)
    names = [None if n is None else str(n) for n in data_np["names"].tolist()]
    feature_bit = {name: i for i, name in enumerate(names) if name}
    bits = np.asarray(data_np["bits"], dtype=np.uint64)
    return feature_bit, bits
