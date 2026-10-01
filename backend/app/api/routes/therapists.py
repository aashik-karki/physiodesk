from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.core.config import clinic_today
from app.core.errors import BusinessRuleError
from app.schemas.therapist import (
    OverrideIn,
    OverrideOut,
    TherapistCreate,
    TherapistDeleted,
    TherapistOut,
    TherapistUpdate,
)
from app.services import therapists as svc

router = APIRouter(prefix="/therapists", tags=["therapists"])


@router.get("", response_model=list[TherapistOut])
def list_therapists(
    db: DbSession,
    _: CurrentUser,
    search: Annotated[str | None, Query(max_length=100)] = None,
    include_inactive: bool = False,
) -> list[TherapistOut]:
    """Roster. Readable by all roles (staff need it to book appointments)."""
    return svc.list_therapists(db, search=search, include_inactive=include_inactive)


@router.get("/{therapist_id}", response_model=TherapistOut)
def get_therapist(therapist_id: int, db: DbSession, _: CurrentUser) -> TherapistOut:
    return svc.get_therapist(db, therapist_id)


@router.post("", response_model=TherapistOut, status_code=status.HTTP_201_CREATED)
def create_therapist(body: TherapistCreate, db: DbSession, _: AdminUser) -> TherapistOut:
    return svc.create_therapist(db, body)


@router.patch("/{therapist_id}", response_model=TherapistOut)
def update_therapist(
    therapist_id: int, body: TherapistUpdate, db: DbSession, _: AdminUser
) -> TherapistOut:
    return svc.update_therapist(db, therapist_id, body)


@router.delete("/{therapist_id}", response_model=TherapistDeleted)
def delete_therapist(therapist_id: int, db: DbSession, _: AdminUser) -> TherapistDeleted:
    """Soft-deletes the therapist and cancels their upcoming bookings.

    Past appointments and invoices are kept for the record.
    """
    cancelled = svc.delete_therapist(db, therapist_id)
    return TherapistDeleted(id=therapist_id, cancelled_appointments=cancelled)


# --- per-date overrides --------------------------------------------------------


@router.get("/{therapist_id}/overrides", response_model=list[OverrideOut])
def list_overrides(
    therapist_id: int,
    db: DbSession,
    _: CurrentUser,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
) -> list[OverrideOut]:
    start = date_from or clinic_today()
    end = date_to or start + timedelta(days=60)
    if end < start:
        raise BusinessRuleError("'to' must not be before 'from'")
    return svc.list_overrides(db, therapist_id, start, end)


@router.put("/{therapist_id}/overrides/{on}", response_model=OverrideOut)
def set_override(
    therapist_id: int, on: date, body: OverrideIn, db: DbSession, _: AdminUser
) -> OverrideOut:
    """Create or replace the schedule for one date: a day off, or custom hours.

    Idempotent (PUT): the date in the path identifies the override.
    Returns 409 if existing bookings would fall outside the new hours.
    """
    return svc.set_override(db, therapist_id, on, body)


@router.delete("/{therapist_id}/overrides/{on}", status_code=status.HTTP_204_NO_CONTENT)
def delete_override(therapist_id: int, on: date, db: DbSession, _: AdminUser) -> Response:
    """Revert a date to the therapist's regular weekly schedule."""
    svc.delete_override(db, therapist_id, on)
    return Response(status_code=status.HTTP_204_NO_CONTENT)