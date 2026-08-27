"""Replay encoding for a new row. No PRAXIS import."""

from __future__ import annotations

from typing import Any


def encode_row(row: dict[str, Any], maps: dict) -> dict[str, float]:
    out: dict[str, float] = {}
    for col in maps["columns"]:
        raw = row.get(col, "")
        kind = maps["kind"][col]
        if kind == "categorical":
            codes = maps.get("codes") or {}
            out[col] = float((codes.get(col) or {}).get(str(raw), -1))
        elif kind == "binary":
            text = str(raw).strip().lower()
            out[col] = 1.0 if text in {"1", "true", "yes", "y"} else 0.0
        else:
            try:
                out[col] = float(raw)
            except (TypeError, ValueError):
                out[col] = float("nan")
    return out
