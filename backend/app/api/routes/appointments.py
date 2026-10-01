from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import clinic_today
from app.models import AppointmentStatus
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentUpdate,
    DaySchedule,
    SlotOut,
)
from app.schemas.common import Page, PageParams
from app.services import appointments as svc

router = APIRouter(prefix="/appointments", tags=["appointments"])
schedule_router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("", response_model=Page[AppointmentOut])
def list_appointments(
    db: DbSession,
    _: CurrentUser,
    page: Annotated[PageParams, Depends()],
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    therapist_id: int | None = None,
    patient_id: int | None = None,
    status: AppointmentStatus | None = None,
    order: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
) -> Page[AppointmentOut]:
    """Appointments, newest first by default. `?patient_id=` gives a patient's session history."""
    return svc.list_appointments(
        db, page, date_from=date_from, date_to=date_to, therapist_id=therapist_id,
        patient_id=patient_id, status=status, newest_first=order == "desc",
    )


@router.get("/{appointment_id}", response_model=AppointmentOut)
def get_appointment(appointment_id: int, db: DbSession, _: CurrentUser) -> AppointmentOut:
    return AppointmentOut.model_validate(svc.get_or_404(db, appointment_id))


@router.post(
    "",
    response_model=AppointmentOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"description": "Therapist or patient already booked at that time"},
        422: {"description": "Not one of the therapist's slots, therapist off, or in the past"},
    },
)
def book_appointment(body: AppointmentCreate, db: DbSession, _: CurrentUser) -> AppointmentOut:
    return AppointmentOut.model_validate(svc.book(db, body))


@router.patch("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: int, body: AppointmentUpdate, db: DbSession, _: CurrentUser
) -> AppointmentOut:
    """Reschedule, change status (e.g. cancel, mark completed), or edit details."""
    return AppointmentOut.model_validate(svc.update(db, appointment_id, body))


@schedule_router.get("", response_model=DaySchedule)
def day_schedule(
    db: DbSession,
    _: CurrentUser,
    on: Annotated[date | None, Query(alias="date", description="Defaults to today")] = None,
) -> DaySchedule:
    """Grid for one date: each therapist's slots marked open, booked or past, or the day off."""
    return svc.day_schedule(db, on or clinic_today())


@schedule_router.get("/availability", response_model=list[SlotOut])
def availability(
    db: DbSession,
    _: CurrentUser,
    therapist_id: int,
    on: Annotated[date, Query(alias="date")],
) -> list[SlotOut]:
    """Open (bookable) slots for one therapist on one date, for the booking form."""
    day = svc.day_schedule(db, on, therapist_id=therapist_id)
    if not day.therapists:
        return []
    return [s for s in day.therapists[0].slots if s.state == "open"]