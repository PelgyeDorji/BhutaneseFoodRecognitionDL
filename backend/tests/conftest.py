"""Tests run against a throwaway SQLite file so they need no running PostgreSQL."""

import io
import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="bfr-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_tmp / 'test.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(_tmp / "uploads")
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 40
os.environ["MODEL_PATH"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.core.rate_limit import login_limiter, register_limiter  # noqa: E402
from app.db.session import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

PASSWORD = "red rice and ezay"


@pytest.fixture(autouse=True)
def fresh_db() -> Iterator[None]:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    login_limiter._hits.clear()
    register_limiter._hits.clear()
    yield


def make_client() -> TestClient:
    client = TestClient(app, base_url="http://localhost")
    client.headers["X-Requested-With"] = "fetch"
    return client


def register(client: TestClient, email: str = "dorji@example.bt", name: str = "Dorji") -> dict:
    response = client.post("/api/auth/register", json={"name": name, "email": email, "password": PASSWORD})
    assert response.status_code == 201, response.text
    return response.json()


def jpeg(color: tuple[int, int, int] = (200, 40, 40), size: tuple[int, int] = (64, 48)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format="JPEG")
    return buffer.getvalue()


@pytest.fixture
def client() -> TestClient:
    return make_client()


@pytest.fixture
def user_client() -> TestClient:
    client = make_client()
    register(client)
    return client
