from fastapi.testclient import TestClient

from tests.conftest import ADMIN, STAFF, auth_header, login

REFRESH_COOKIE = "pd_refresh"


def test_login_returns_access_token_and_httponly_refresh_cookie(client: TestClient, users):
    res = client.post("/api/auth/login", json=ADMIN)
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"]
    assert body["user"]["role"] == "admin"
    assert "refresh_token" not in body  # refresh token must not be readable by JS

    set_cookie = res.headers["set-cookie"]
    assert f"{REFRESH_COOKIE}=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Path=/api/auth" in set_cookie


def test_login_is_case_insensitive_on_email(client: TestClient, users):
    res = client.post("/api/auth/login", json={**ADMIN, "email": ADMIN["email"].upper()})
    assert res.status_code == 200


def test_wrong_password_and_unknown_email_give_the_same_401(client: TestClient, users):
    wrong_pw = client.post("/api/auth/login", json={**ADMIN, "password": "nope"})
    unknown = client.post("/api/auth/login", json={"email": "ghost@physiodesk.dev", "password": "x"})
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json()  # no user enumeration via messages


def test_me_requires_a_valid_access_token(client: TestClient, users):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=auth_header("garbage")).status_code == 401

    token = login(client, STAFF)
    res = client.get("/api/auth/me", headers=auth_header(token))
    assert res.status_code == 200
    assert res.json()["email"] == STAFF["email"]


def test_refresh_token_cannot_be_used_as_access_token(client: TestClient, users):
    client.post("/api/auth/login", json=ADMIN)
    refresh = client.cookies[REFRESH_COOKIE]
    assert client.get("/api/auth/me", headers=auth_header(refresh)).status_code == 401


def test_refresh_rotates_the_token(client: TestClient, users):
    client.post("/api/auth/login", json=ADMIN)
    first = client.cookies[REFRESH_COOKIE]

    res = client.post("/api/auth/refresh")
    assert res.status_code == 200
    assert res.json()["access_token"]
    second = client.cookies[REFRESH_COOKIE]
    assert second != first


def _age_rotated_tokens(db, seconds: int) -> None:
    """Pretend every rotation happened `seconds` ago (outside the grace window)."""
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import update

    from app.models import RefreshToken

    db.execute(
        update(RefreshToken)
        .where(RefreshToken.revoked_at.is_not(None))
        .values(revoked_at=datetime.now(UTC) - timedelta(seconds=seconds))
    )
    db.commit()


def test_reusing_a_rotated_refresh_token_revokes_all_sessions(client: TestClient, users, db):
    client.post("/api/auth/login", json=ADMIN)
    stolen = client.cookies[REFRESH_COOKIE]
    client.post("/api/auth/refresh")  # legitimate rotation
    current = client.cookies[REFRESH_COOKIE]
    _age_rotated_tokens(db, 120)  # the replay happens well after the rotation

    # Attacker replays the old token -> rejected, and the family is burned.
    attacker = TestClient(client.app)
    attacker.cookies.set(REFRESH_COOKIE, stolen, path="/api/auth")
    assert attacker.post("/api/auth/refresh").status_code == 401

    # The legitimate user's current token no longer works either.
    victim = TestClient(client.app)
    victim.cookies.set(REFRESH_COOKIE, current, path="/api/auth")
    assert victim.post("/api/auth/refresh").status_code == 401


def test_logout_revokes_the_refresh_token(client: TestClient, users):
    client.post("/api/auth/login", json=ADMIN)
    token = client.cookies[REFRESH_COOKIE]
    assert client.post("/api/auth/logout").status_code == 204

    replay = TestClient(client.app)
    replay.cookies.set(REFRESH_COOKIE, token, path="/api/auth")
    assert replay.post("/api/auth/refresh").status_code == 401


def test_logout_all_revokes_every_session(client: TestClient, users):
    laptop, phone = TestClient(client.app), TestClient(client.app)
    access = login(laptop, ADMIN)
    login(phone, ADMIN)

    assert laptop.post("/api/auth/logout-all", headers=auth_header(access)).status_code == 204
    assert phone.post("/api/auth/refresh").status_code == 401


def test_role_guard_is_enforced_server_side(client: TestClient, users):
    staff_token = login(client, STAFF)
    admin_token = login(client, ADMIN)
    assert client.get("/api/_test/admin-only", headers=auth_header(staff_token)).status_code == 403
    assert client.get("/api/_test/admin-only", headers=auth_header(admin_token)).status_code == 200


def test_deactivated_user_is_locked_out_immediately(client: TestClient, users, db):
    token = login(client, STAFF)
    staff = users["staff"]
    staff.is_active = False
    db.merge(staff)
    db.commit()
    assert client.get("/api/auth/me", headers=auth_header(token)).status_code == 401


def test_two_tabs_refreshing_at_once_stay_logged_in(client: TestClient, users):
    """Same cookie sent twice within seconds (two tabs) is a race, not theft."""
    client.post("/api/auth/login", json=ADMIN)
    cookie = client.cookies[REFRESH_COOKIE]
    tab_a, tab_b = TestClient(client.app), TestClient(client.app)
    for tab in (tab_a, tab_b):
        tab.cookies.set(REFRESH_COOKIE, cookie, path="/api/auth")
    assert tab_a.post("/api/auth/refresh").status_code == 200
    assert tab_b.post("/api/auth/refresh").status_code == 200
    # neither tab was logged out
    assert tab_a.post("/api/auth/refresh").status_code == 200
    assert tab_b.post("/api/auth/refresh").status_code == 200


def test_reuse_after_logout_is_still_rejected(client: TestClient, users):
    client.post("/api/auth/login", json=ADMIN)
    token = client.cookies[REFRESH_COOKIE]
    client.post("/api/auth/logout")
    replay = TestClient(client.app)
    replay.cookies.set(REFRESH_COOKIE, token, path="/api/auth")
    assert replay.post("/api/auth/refresh").status_code == 401
