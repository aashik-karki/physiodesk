"""Test fixtures.

Tests run against a real Postgres database (TEST_DATABASE_URL), because the
integrity rules we care about most (partial unique indexes, check constraints,
enums) only exist in Postgres. The schema is built with the real Alembic
migration, so the tests also prove the migration works.
"""

import os

TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://physiodesk:physiodesk@localhost:5434/physiodesk_test",
)
# Must be set before any app module reads settings.
os.environ["DATABASE_URL"] = TEST_DB_URL

from collections.abc import Generator  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi import Depends  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.api.deps import require_roles  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User, UserRole  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ADMIN = {"email": "admin@physiodesk.dev", "password": "admin-pass-123"}
STAFF = {"email": "staff@physiodesk.dev", "password": "staff-pass-123"}


@app.get("/api/_test/admin-only", include_in_schema=False)
def _admin_only(_=Depends(require_roles(UserRole.ADMIN))):
    return {"ok": True}


@pytest.fixture(scope="session", autouse=True)
def _migrated_schema() -> Generator[None, None, None]:
    # The fixture below wipes the whole schema. Refuse to run against anything that
    # isn't clearly a test database, so a wrong env var can't destroy real data.
    if not engine.url.database or not engine.url.database.endswith("_test"):
        pytest.exit(f"Refusing to run tests against '{engine.url.database}': name must end in _test", returncode=2)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def _clean_tables() -> None:
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def users(db: Session) -> dict[str, User]:
    admin = User(
        email=ADMIN["email"], full_name="Admin", role=UserRole.ADMIN,
        password_hash=hash_password(ADMIN["password"]),
    )
    staff = User(
        email=STAFF["email"], full_name="Staff", role=UserRole.STAFF,
        password_hash=hash_password(STAFF["password"]),
    )
    db.add_all([admin, staff])
    db.commit()
    return {"admin": admin, "staff": staff}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def login(client: TestClient, creds: dict[str, str]) -> str:
    res = client.post("/api/auth/login", json=creds)
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
