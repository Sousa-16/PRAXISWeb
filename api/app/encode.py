"""Replay encoding for a new row. No PRAXIS import."""

from __future__ import annotations

from typing import Any

# Rare categorical values collapsed at fit time; score unknown strings the same way.
OTHER_CATEGORY = "__other__"


def encode_row(row: dict[str, Any], maps: dict) -> dict[str, float]:
    out: dict[str, float] = {}
    for col in maps["columns"]:
        raw = row.get(col, "")
        kind = maps["kind"][col]
        if kind == "categorical":
            col_codes = (maps.get("codes") or {}).get(col) or {}
            key = str(raw)
            if key in col_codes:
                out[col] = float(col_codes[key])
            elif OTHER_CATEGORY in col_codes:
                out[col] = float(col_codes[OTHER_CATEGORY])
            else:
                out[col] = -1.0
        elif kind == "binary":
            text = str(raw).strip().lower()
            out[col] = 1.0 if text in {"1", "true", "yes", "y"} else 0.0
        else:
            try:
                out[col] = float(raw)
            except (TypeError, ValueError):
                out[col] = float("nan")
    return out
