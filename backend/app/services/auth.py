import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.security import (TokenError, create_access_token, create_refresh_token,
                               decode_token, verify_password)
from app.models import RefreshToken, User
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, create_refresh_token, verify_password
from app.models import RefreshToken, User


class AuthError(Exception):
    pass


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not verify_password(password, user.password_hash if user else None) or user is None:
        raise AuthError("Invalid email or password")
    if not user.is_active:
        raise AuthError("Account is disabled")
    return user


def issue_tokens(db: Session, user: User) -> tuple[str, str]:
    """Create an access token and a stored refresh token. Caller commits."""
    access = create_access_token(user.id, user.role.value)
    refresh, jti, iat, exp = create_refresh_token(user.id)
    db.add(RefreshToken(jti=jti, user_id=user.id, issued_at=iat, expires_at=exp))
    return access, refresh




def revoke_all(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def rotate(db: Session, refresh_token: str) -> tuple[User, str, str]:
    """Swap a refresh token for a new pair. The old one is revoked.

    If an already-revoked token is presented, it was probably stolen and replayed,
    so every session of that user is revoked.
    """
    try:
        jti = uuid.UUID(decode_token(refresh_token, "refresh")["jti"])
    except (TokenError, KeyError, ValueError) as exc:
        raise AuthError("Invalid refresh token") from exc

    stored = db.get(RefreshToken, jti, with_for_update=True)
    if stored is None:
        raise AuthError("Invalid refresh token")
    if stored.revoked_at is not None:
        revoke_all(db, stored.user_id)
        db.commit()
        raise AuthError("Refresh token reuse detected; all sessions revoked")

    user = db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise AuthError("Account is disabled")

    access, new_refresh = issue_tokens(db, user)
    stored.revoked_at = datetime.now(UTC)
    stored.replaced_by = uuid.UUID(decode_token(new_refresh, "refresh")["jti"])
    db.commit()
    return user, access, new_refresh


def revoke(db: Session, refresh_token: str) -> None:
    try:
        jti = uuid.UUID(decode_token(refresh_token, "refresh")["jti"])
    except (TokenError, KeyError, ValueError):
        return
    stored = db.get(RefreshToken, jti)
    if stored and stored.revoked_at is None:
        stored.revoked_at = datetime.now(UTC)
        db.commit()    