import os

os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    init_db()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
