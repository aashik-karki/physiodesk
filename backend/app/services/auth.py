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