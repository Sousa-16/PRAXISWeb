"""Read and preview a labeled CSV. No PRAXIS import."""

from __future__ import annotations

import io

import pandas as pd


def read_csv(raw: bytes) -> pd.DataFrame:
    return pd.read_csv(io.BytesIO(raw))


def guess_label(columns: list[str]) -> str:
    keys = ("label", "target", "y", "class", "outcome", "approved", "churn", "default")
    lower = {c.lower(): c for c in columns}
    for k in keys:
        if k in lower:
            return lower[k]
    return columns[-1]


def preview_frame(df: pd.DataFrame) -> dict:
    cols = [str(c) for c in df.columns]
    label = guess_label(cols)
    counts = df[label].astype(str).value_counts().head(12)
    return {
        "n_rows": int(len(df)),
        "n_cols": int(df.shape[1]),
        "columns": cols,
        "guessed_label": label,
        "class_counts": {str(k): int(v) for k, v in counts.items()},
        "head": df.head(5).astype(str).to_dict(orient="records"),
    }
