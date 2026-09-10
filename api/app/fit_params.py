"""PRAXIS fit/search parameters: defaults, bounds, and validation."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

# Defaults match compile_table / FIT_ROWS / MAX_TREES today.
DEFAULT_LAMBDA_REG = 0.01
DEFAULT_DEPTH_BUDGET = 5
DEFAULT_RASHOMON_MULT = 0.05
DEFAULT_LOOKAHEAD_K = 1
DEFAULT_FIT_ROWS = 2000
DEFAULT_MAX_TREES = 2000


class FitParams(BaseModel):
    """User-tunable PRAXIS search settings (validated + clamped)."""

    lambda_reg: float = Field(default=DEFAULT_LAMBDA_REG, ge=0.001, le=0.1)
    depth_budget: int = Field(default=DEFAULT_DEPTH_BUDGET, ge=2, le=8)
    rashomon_mult: float = Field(default=DEFAULT_RASHOMON_MULT, ge=0.0, le=0.2)
    lookahead_k: int = Field(default=DEFAULT_LOOKAHEAD_K, ge=0, le=7)
    fit_rows: int = Field(default=DEFAULT_FIT_ROWS, ge=100, le=5000)
    max_trees: int = Field(default=DEFAULT_MAX_TREES, ge=50, le=5000)

    @field_validator("lambda_reg", "rashomon_mult", mode="before")
    @classmethod
    def _as_float(cls, v: Any) -> Any:
        if v is None or v == "":
            return v
        return float(v)

    @field_validator("depth_budget", "lookahead_k", "fit_rows", "max_trees", mode="before")
    @classmethod
    def _as_int(cls, v: Any) -> Any:
        if v is None or v == "":
            return v
        return int(v)

    @model_validator(mode="after")
    def _lookahead_vs_depth(self) -> FitParams:
        max_k = max(0, self.depth_budget - 1)
        if self.lookahead_k > max_k:
            self.lookahead_k = max_k
        return self

    def as_compile_kwargs(self) -> dict[str, Any]:
        return {
            "lambda_reg": float(self.lambda_reg),
            "depth_budget": int(self.depth_budget),
            "rashomon_mult": float(self.rashomon_mult),
            "lookahead_k": int(self.lookahead_k),
            "fit_rows": int(self.fit_rows),
            "max_trees": int(self.max_trees),
        }


def normalize_fit_params(raw: FitParams | dict[str, Any] | None) -> FitParams:
    if raw is None:
        return FitParams()
    if isinstance(raw, FitParams):
        return raw
    data = dict(raw)
    # Pre-clamp so out-of-range UI/API values become nearest legal, then enforce
    # lookahead_k vs depth_budget in the model validator.
    clamps: dict[str, tuple[float, float]] = {
        "lambda_reg": (0.001, 0.1),
        "depth_budget": (2, 8),
        "rashomon_mult": (0.0, 0.2),
        "lookahead_k": (0, 7),
        "fit_rows": (100, 5000),
        "max_trees": (50, 5000),
    }
    for key, (lo, hi) in clamps.items():
        if key not in data or data[key] is None or data[key] == "":
            continue
        try:
            v = float(data[key]) if key in {"lambda_reg", "rashomon_mult"} else int(data[key])
        except (TypeError, ValueError):
            continue
        data[key] = max(lo, min(hi, v))
    return FitParams.model_validate(data)


def fit_params_public_meta() -> dict[str, Any]:
    """Bounds + defaults for the UI (also enforced server-side)."""
    return {
        "defaults": FitParams().as_compile_kwargs(),
        "bounds": {
            "lambda_reg": {"min": 0.001, "max": 0.1},
            "depth_budget": {"min": 2, "max": 8},
            "rashomon_mult": {"min": 0.0, "max": 0.2},
            "lookahead_k": {"min": 0, "max": 7},
            "fit_rows": {"min": 100, "max": 5000},
            "max_trees": {"min": 50, "max": 5000},
        },
    }
