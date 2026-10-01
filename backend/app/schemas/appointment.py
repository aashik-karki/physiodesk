from datetime import date as Date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AppointmentStatus, PaymentMethod, SessionType
from app.schemas.therapist import TherapistRef


class PatientRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    phone: str


class AppointmentCreate(BaseModel):
    patient_id: int
    therapist_id: int
    date: Date
    start_time: time = Field(description="Must be the start of one of the therapist's slots that day")
    payment_method: PaymentMethod
    session_type: SessionType = SessionType.TREATMENT
    notes: str | None = Field(default=None, max_length=2000)


class AppointmentUpdate(BaseModel):
    """Reschedule (therapist/date/start_time), change status, or edit details.

    Status can only move away from `booked` (to completed, cancelled or no_show).
    """

    therapist_id: int | None = None
    date: Date | None = None
    start_time: time | None = None
    status: AppointmentStatus | None = None
    payment_method: PaymentMethod | None = None
    session_type: SessionType | None = None
    notes: str | None = Field(default=None, max_length=2000)


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient: PatientRef
    therapist: TherapistRef
    date: Date
    start_time: time
    end_time: time
    status: AppointmentStatus
    session_type: SessionType
    payment_method: PaymentMethod
    notes: str | None
    created_at: datetime


# --- day schedule grid -----------------------------------------------------------

SlotState = Literal["open", "booked", "past"]


class SlotAppointment(BaseModel):
    id: int
    patient_id: int
    patient_name: str
    status: AppointmentStatus
    session_type: SessionType


class SlotOut(BaseModel):
    start: time
    end: time
    state: SlotState = Field(description="open = bookable; past = unbooked and already gone")
    out_of_hours: bool = Field(
        default=False,
        description="A booking that no longer fits the therapist's hours (schedule changed later)",
    )
    appointment: SlotAppointment | None = None


class ScheduleTherapist(BaseModel):
    id: int
    full_name: str
    specialty: str
    slot_minutes: int
    is_active: bool


class TherapistDay(BaseModel):
    therapist: ScheduleTherapist
    is_off: bool
    off_reason: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    has_override: bool = False
    slots: list[SlotOut]
    booked_count: int
    open_count: int


class DaySchedule(BaseModel):
    date: Date
    therapists: list[TherapistDay]