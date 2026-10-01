from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.schemas.common import Name, Phone, ShortText


def _normalise_days(days: list[int] | None) -> list[int] | None:
    if days is None:
        return None
    if not days:
        raise ValueError("Pick at least one working day")
    if any(d < 1 or d > 7 for d in days):
        raise ValueError("Working days are ISO weekdays: 1 (Mon) to 7 (Sun)")
    return sorted(set(days))


class TherapistCreate(BaseModel):
    full_name: Name
    specialty: ShortText
    phone: Phone | None = None
    email: EmailStr | None = None
    working_days: list[int] = Field(examples=[[1, 2, 3, 4, 5]], description="ISO weekdays, 1=Mon")
    start_time: time = Field(examples=["09:00"])
    end_time: time = Field(examples=["17:00"])
    slot_minutes: int = Field(default=45, ge=10, le=240)

    _days = field_validator("working_days")(_normalise_days)

    @model_validator(mode="after")
    def _hours_in_order(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class TherapistUpdate(BaseModel):
    """Partial update. Cross-field rules are re-checked against the merged result."""

    full_name: Name | None = None
    specialty: ShortText | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    working_days: list[int] | None = None
    start_time: time | None = None
    end_time: time | None = None
    slot_minutes: int | None = Field(default=None, ge=10, le=240)

    _days = field_validator("working_days")(_normalise_days)


class TherapistRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str


class TherapistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    specialty: str
    phone: str | None
    email: str | None
    working_days: list[int]
    start_time: time
    end_time: time
    slot_minutes: int
    is_active: bool
    weekly_hours: float
    patients_today: int = Field(description="Distinct patients with a non-cancelled appointment today")
    on_duty_today: bool


class TherapistDeleted(BaseModel):
    id: int
    cancelled_appointments: int = Field(description="Future bookings cancelled by the removal")


class OverrideIn(BaseModel):
    is_off: bool
    start_time: time | None = None
    end_time: time | None = None
    reason: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _off_or_hours(self):
        if self.is_off:
            self.start_time = self.end_time = None
        elif self.start_time is None or self.end_time is None:
            raise ValueError("Custom hours need both start_time and end_time")
        elif self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class OverrideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    therapist_id: int
    date: date
    is_off: bool
    start_time: time | None
    end_time: time | None
    reason: str | None
    created_at: datetime