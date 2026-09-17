from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

connect_args = {}
engine_kwargs: dict = {"echo": False}
url = settings.sqlalchemy_url()
if url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    if ":memory:" in url or url.endswith("sqlite://"):
        engine_kwargs["poolclass"] = StaticPool
elif settings.is_postgres():
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = int(os.environ.get("DB_POOL_SIZE", "5"))
    engine_kwargs["max_overflow"] = int(os.environ.get("DB_MAX_OVERFLOW", "10"))

engine = create_engine(url, connect_args=connect_args, **engine_kwargs)

if url.startswith("sqlite") and ":memory:" not in url and not url.endswith("sqlite://"):
    # Allow Delete my data while another thread is between commits.
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA journal_mode=WAL")
        conn.commit()


def init_db() -> None:
    from app.migrate import upgrade_head

    upgrade_head()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
