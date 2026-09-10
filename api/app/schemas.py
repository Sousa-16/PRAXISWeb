"""HTTP request/response bodies for the PRAXIS Web API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.fit_params import FitParams


class JobCreate(BaseModel):
    dataset_id: str
    label: str
    params: FitParams | dict[str, Any] | None = None


class ScoreBody(BaseModel):
    row: dict[str, Any] = Field(default_factory=dict)
    tree_id: int = 0
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)


class PolicyCreate(BaseModel):
    job_id: str
    tree_id: int
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)
    name: str = ""
    notes: str = ""


class PolicyScoreBody(BaseModel):
    row: dict[str, Any] = Field(default_factory=dict)


class ImpactBody(BaseModel):
    tree_id: int = 0
    banned: list[str] = Field(default_factory=list)
    keep: list[str] = Field(default_factory=list)
    group_by: str = ""
