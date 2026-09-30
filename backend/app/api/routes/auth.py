from typing import Annotated

from fastapi import APIRouter, Cookie, HTTPException, Response, status
from fastapi.responses import JSONResponse
from fastapi import APIRouter, HTTPException, Response, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "pd_refresh"
REFRESH_COOKIE_PATH = "/api/auth"


def set_refresh_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        REFRESH_COOKIE, token,
        max_age=s.refresh_token_expire_days * 86400,
        httponly=True, secure=s.cookie_secure, samesite="lax", path=REFRESH_COOKIE_PATH,
    )

def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)

def token_response(user, access: str) -> TokenResponse:
    return TokenResponse(
        access_token=access,
        expires_in=get_settings().access_token_expire_minutes * 60,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, response: Response, db: DbSession) -> TokenResponse:
    try:
        user = auth_service.authenticate(db, body.email, body.password)
    except auth_service.AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from None
    access, refresh = auth_service.issue_tokens(db, user)
    db.commit()
    set_refresh_cookie(response, refresh)
    return token_response(user, access)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)



@router.post("/refresh", response_model=TokenResponse)
def refresh(response: Response, db: DbSession, pd_refresh: Annotated[str | None, Cookie()] = None):
    """Rotate the refresh token from the cookie and return a new access token."""
    if not pd_refresh:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No refresh token")
    try:
        user, access, new_refresh = auth_service.rotate(db, pd_refresh)
    except auth_service.AuthError as exc:
        # Return (not raise) so the cookie-clearing header is kept.
        failed = JSONResponse({"detail": str(exc)}, status_code=status.HTTP_401_UNAUTHORIZED)
        clear_refresh_cookie(failed)
        return failed
    set_refresh_cookie(response, new_refresh)
    return token_response(user, access)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, db: DbSession, pd_refresh: Annotated[str | None, Cookie()] = None):
    if pd_refresh:
        auth_service.revoke(db, pd_refresh)
    response.status_code = status.HTTP_204_NO_CONTENT
    clear_refresh_cookie(response)
    return response


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(user: CurrentUser, response: Response, db: DbSession):
    """Sign out on every device."""
    auth_service.revoke_all(db, user.id)
    db.commit()
    response.status_code = status.HTTP_204_NO_CONTENT
    clear_refresh_cookie(response)
    return response