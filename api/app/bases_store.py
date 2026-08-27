"""Disk or S3 cache of per-tree feature bitmasks for live match counts after API restart."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from app.config import settings


def _cache_dir() -> Path:
    return settings.bases_cache_path()


def _local_path(job_id: str) -> Path:
    return _cache_dir() / f"{job_id}.npz"


def save(job_id: str, feature_bit: dict[str, int], bases_bits: np.ndarray) -> None:
    if settings.uses_s3_storage():
        from app.object_storage import pack_npz, s3_put

        s3_put(job_id, pack_npz(feature_bit, bases_bits))
        return
    cache = _cache_dir()
    cache.mkdir(parents=True, exist_ok=True)
    names: list[str | None] = [None] * len(feature_bit)
    for name, idx in feature_bit.items():
        names[idx] = name
    np.savez_compressed(
        _local_path(job_id),
        bits=np.asarray(bases_bits, dtype=np.uint64),
        names=np.array(names, dtype=object),
    )


def save_bundle(job_id: str, bundle) -> None:
    if bundle.bases_bits is None or bundle.feature_bit is None:
        return
    save(job_id, bundle.feature_bit, bundle.bases_bits)


def load(job_id: str) -> tuple[dict[str, int], np.ndarray] | None:
    if settings.uses_s3_storage():
        from app.object_storage import s3_get, unpack_npz

        raw = s3_get(job_id)
        if raw is None:
            return None
        return unpack_npz(raw)
    path = _local_path(job_id)
    if not path.is_file():
        return None
    data = np.load(path, allow_pickle=True)
    names = [None if n is None else str(n) for n in data["names"].tolist()]
    feature_bit = {name: i for i, name in enumerate(names) if name}
    bits = np.asarray(data["bits"], dtype=np.uint64)
    return feature_bit, bits


def drop(job_id: str) -> None:
    if settings.uses_s3_storage():
        from app.object_storage import s3_delete

        s3_delete(job_id)
        return
    path = _local_path(job_id)
    if path.is_file():
        path.unlink()


def storage_ok() -> bool:
    if settings.uses_s3_storage():
        try:
            from app.object_storage import s3_ping

            return s3_ping()
        except Exception:
            return False
    try:
        cache = _cache_dir()
        cache.mkdir(parents=True, exist_ok=True)
        probe = cache / ".write_probe"
        probe.write_text("ok")
        probe.unlink(missing_ok=True)
        return True
    except Exception:
        return False


def count_bits(
    bases_bits: np.ndarray,
    feature_bit: dict[str, int],
    banned: list[str] | None = None,
    keep: list[str] | None = None,
) -> dict[str, int | bool]:
    """Match-count using only the bit index (no PRAXIS model required)."""
    banned_set = set(banned or [])
    keep_set = set(keep or [])
    n_trees = int(bases_bits.shape[0])
    n_words = int(bases_bits.shape[1]) if bases_bits.ndim == 2 else 1
    bits = bases_bits if bases_bits.ndim == 2 else bases_bits.reshape(n_trees, 1)

    if keep_set and any(name not in feature_bit for name in keep_set):
        return {"n_matching": 0, "n_trees": n_trees, "indexed": True}

    banned_m = np.zeros(n_words, dtype=np.uint64)
    keep_m = np.zeros(n_words, dtype=np.uint64)
    for name in banned_set:
        bit = feature_bit.get(name)
        if bit is None:
            continue
        banned_m[bit // 64] |= np.uint64(1) << np.uint64(bit % 64)
    for name in keep_set:
        bit = feature_bit[name]
        keep_m[bit // 64] |= np.uint64(1) << np.uint64(bit % 64)

    ok = np.ones(n_trees, dtype=bool)
    if banned_set:
        hit = np.zeros(n_trees, dtype=bool)
        for w in range(n_words):
            if banned_m[w] == 0:
                continue
            hit |= (bits[:, w] & banned_m[w]) != 0
        ok &= ~hit
    if keep_set:
        for w in range(n_words):
            if keep_m[w] == 0:
                continue
            ok &= (bits[:, w] & keep_m[w]) == keep_m[w]
    return {"n_matching": int(np.count_nonzero(ok)), "n_trees": n_trees, "indexed": True}
