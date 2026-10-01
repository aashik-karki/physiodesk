from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.schemas.therapist import TherapistCreate, TherapistDeleted, TherapistOut, TherapistUpdate
from app.services import therapists as svc

router = APIRouter(prefix="/therapists", tags=["therapists"])


@router.get("", response_model=list[TherapistOut])
def list_therapists(
    db: DbSession,
    _: CurrentUser,
    search: Annotated[str | None, Query(max_length=100)] = None,
    include_inactive: bool = False,
):
    """Roster. Every logged-in user can read it (staff need it to book)."""
    return svc.list_therapists(db, search, include_inactive)


@router.get("/{therapist_id}", response_model=TherapistOut)
def get_therapist(therapist_id: int, db: DbSession, _: CurrentUser):
    return svc.get_therapist(db, therapist_id)


@router.post("", response_model=TherapistOut, status_code=status.HTTP_201_CREATED)
def create_therapist(body: TherapistCreate, db: DbSession, _: AdminUser):
    return svc.create_therapist(db, body)


@router.patch("/{therapist_id}", response_model=TherapistOut)
def update_therapist(therapist_id: int, body: TherapistUpdate, db: DbSession, _: AdminUser):
    return svc.update_therapist(db, therapist_id, body)


@router.delete("/{therapist_id}", response_model=TherapistDeleted)
def delete_therapist(therapist_id: int, db: DbSession, _: AdminUser):
    """Soft delete. Upcoming bookings are cancelled; history is kept."""
    return TherapistDeleted(id=therapist_id, cancelled_appointments=svc.delete_therapist(db, therapist_id))