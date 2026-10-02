from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.dashboard import Dashboard
from app.services.dashboard import build_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=Dashboard)
def dashboard(
    db: DbSession,
    _: CurrentUser,
    recent: Annotated[int, Query(ge=1, le=20, description="How many recent patients")] = 5,
) -> Dashboard:
    """Everything the dashboard needs in one request, computed live."""
    return build_dashboard(db, recent_limit=recent)