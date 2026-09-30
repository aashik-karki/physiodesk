import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import bcrypt
import jwt

from app.core.config import get_settings

TokenType = Literal["access", "refresh"]
BCRYPT_MAX_BYTES = 72
_DUMMY_HASH = bcrypt.hashpw(b"timing-equaliser", bcrypt.gensalt()).decode()


def hash_password(password: str) -> str:
    raw = password.encode()
    if len(raw) > BCRYPT_MAX_BYTES:
        raise ValueError("Password is too long")
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    """Pass None when the user doesn't exist; we still spend one bcrypt check."""
    raw = password.encode()
    too_long = len(raw) > BCRYPT_MAX_BYTES
    matches = bcrypt.checkpw(raw[:BCRYPT_MAX_BYTES], (password_hash or _DUMMY_HASH).encode())
    return matches and not too_long and password_hash is not None


class TokenError(Exception):
    pass


def _encode(claims: dict[str, Any]) -> str:
    s = get_settings()
    return jwt.encode(claims, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(UTC)
    return _encode({
        "sub": str(user_id), "role": role, "type": "access", "iat": now,
        "exp": now + timedelta(minutes=get_settings().access_token_expire_minutes),
    })


def create_refresh_token(user_id: int) -> tuple[str, uuid.UUID, datetime, datetime]:
    now = datetime.now(UTC)
    exp = now + timedelta(days=get_settings().refresh_token_expire_days)
    jti = uuid.uuid4()
    token = _encode({"sub": str(user_id), "jti": str(jti), "type": "refresh", "iat": now, "exp": exp})
    return token, jti, now, exp


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    s = get_settings()
    try:
        claims = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm],
                            options={"require": ["sub", "exp", "type"]})
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
    if claims.get("type") != expected_type:
        raise TokenError("Wrong token type")
    return claims