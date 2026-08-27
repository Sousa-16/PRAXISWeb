from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, LargeBinary, Text
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Dataset(SQLModel, table=True):
    __tablename__ = "datasets"

    id: str = Field(primary_key=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    filename: str
    csv_bytes: bytes = Field(sa_column=Column(LargeBinary, nullable=False))
    preview_json: str = Field(sa_column=Column(Text, nullable=False))
    session_id: Optional[str] = Field(default=None, index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    delete_after: Optional[datetime] = Field(default=None, index=True)


class Job(SQLModel, table=True):
    __tablename__ = "jobs"

    id: str = Field(primary_key=True)
    dataset_id: str = Field(index=True)
    label: str
    status: str = Field(index=True)
    error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    result_json: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    search_document: str = Field(default="", sa_column=Column(Text, nullable=False))
    session_id: Optional[str] = Field(default=None, index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    finished_at: Optional[datetime] = None
    delete_after: Optional[datetime] = Field(default=None, index=True)


class Policy(SQLModel, table=True):
    __tablename__ = "policies"

    id: str = Field(primary_key=True)
    job_id: str = Field(index=True)
    tree_id: int
    constraints_json: str = Field(sa_column=Column(Text, nullable=False))
    policy_json: str = Field(sa_column=Column(Text, nullable=False))
    search_document: str = Field(default="", sa_column=Column(Text, nullable=False))
    session_id: Optional[str] = Field(default=None, index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    delete_after: Optional[datetime] = Field(default=None, index=True)
