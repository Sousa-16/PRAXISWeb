"""Read and preview a labeled CSV. No PRAXIS import."""

from __future__ import annotations

import io

import pandas as pd


def read_csv(raw: bytes) -> pd.DataFrame:
    if not raw or not raw.strip():
        raise ValueError("The file is empty.")
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except UnicodeDecodeError:
        try:
            df = pd.read_csv(io.BytesIO(raw), encoding="latin-1")
        except Exception as exc:
            raise ValueError("Could not read that CSV. Use a UTF-8 comma-separated file.") from exc
    except pd.errors.EmptyDataError as exc:
        raise ValueError("The CSV has no columns.") from exc
    except pd.errors.ParserError as exc:
        raise ValueError("Could not parse that CSV. Check commas, quotes, and the header row.") from exc
    except Exception as exc:
        raise ValueError("Could not read that CSV. Use a comma-separated file with a header row.") from exc
    if df.shape[1] < 2:
        raise ValueError("Need a header row and at least one feature column plus a label.")
    return df


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
