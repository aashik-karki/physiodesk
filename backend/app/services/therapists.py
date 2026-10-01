from datetime import date, datetime, time

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from app.core.config import clinic_now, clinic_today
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.models import Appointment, AppointmentStatus, Therapist, TherapistOverride
from app.schemas.therapist import OverrideIn, TherapistCreate, TherapistOut, TherapistUpdate
from app.services.availability import overrides_for_date, weekly_minutes, working_window

# Appointments that count as "on the books" (occupy a slot / count as a visit).
LIVE_STATUSES = (AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED)


def get_or_404(db: Session, therapist_id: int, *, active_only: bool = False) -> Therapist:
    therapist = db.get(Therapist, therapist_id)
    if therapist is None or (active_only and not therapist.is_active):
        raise NotFoundError("Therapist not found")
    return therapist


def _patients_today_by_therapist(db: Session, today: date) -> dict[int, int]:
    rows = db.execute(
        select(Appointment.therapist_id, func.count(func.distinct(Appointment.patient_id)))
        .where(Appointment.date == today, Appointment.status.in_(LIVE_STATUSES))
        .group_by(Appointment.therapist_id)
    )
    return dict(rows.all())


def to_out(
    t: Therapist,
    today: date,
    patients_today: dict[int, int],
    overrides: dict[int, TherapistOverride],
) -> TherapistOut:
    on_duty = t.is_active and (
        working_window(t.working_days, t.start_time, t.end_time, today, overrides.get(t.id))
        is not None
    )
    return TherapistOut(
        id=t.id,
        full_name=t.full_name,
        specialty=t.specialty,
        phone=t.phone,
        email=t.email,
        working_days=t.working_days,
        start_time=t.start_time,
        end_time=t.end_time,
        slot_minutes=t.slot_minutes,
        is_active=t.is_active,
        weekly_hours=round(weekly_minutes(t.working_days, t.start_time, t.end_time) / 60, 1),
        patients_today=patients_today.get(t.id, 0),
        on_duty_today=on_duty,
    )


def list_therapists(
    db: Session, *, search: str | None = None, include_inactive: bool = False
) -> list[TherapistOut]:
    stmt = select(Therapist).order_by(Therapist.full_name)
    if not include_inactive:
        stmt = stmt.where(Therapist.is_active.is_(True))
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Therapist.full_name.ilike(like), Therapist.specialty.ilike(like)))
    today = clinic_today()
    counts = _patients_today_by_therapist(db, today)
    overrides = overrides_for_date(db, today)
    return [to_out(t, today, counts, overrides) for t in db.scalars(stmt)]


def get_therapist(db: Session, therapist_id: int) -> TherapistOut:
    t = get_or_404(db, therapist_id)
    today = clinic_today()
    return to_out(t, today, _patients_today_by_therapist(db, today), overrides_for_date(db, today))


def create_therapist(db: Session, data: TherapistCreate) -> TherapistOut:
    t = Therapist(**data.model_dump())
    db.add(t)
    db.commit()
    return get_therapist(db, t.id)


def update_therapist(db: Session, therapist_id: int, data: TherapistUpdate) -> TherapistOut:
    t = get_or_404(db, therapist_id, active_only=True)
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is None and field in {"full_name", "specialty", "working_days", "start_time", "end_time", "slot_minutes"}:
            raise BusinessRuleError(f"{field} cannot be empty")
        setattr(t, field, value)
    if t.end_time <= t.start_time:
        raise BusinessRuleError("end_time must be after start_time")
    # Assumption: changing the weekly schedule does not touch existing bookings.
    # They stay valid and visible; staff reschedule them if needed.
    db.commit()
    return get_therapist(db, t.id)


def _future_live_appointments(therapist_id: int, now: datetime):
    today, now_t = now.date(), now.time()
    return and_(
        Appointment.therapist_id == therapist_id,
        Appointment.status == AppointmentStatus.BOOKED,
        or_(Appointment.date > today, and_(Appointment.date == today, Appointment.start_time >= now_t)),
    )


def delete_therapist(db: Session, therapist_id: int) -> int:
    """Soft delete. Past history stays; upcoming bookings are cancelled.

    Returns how many upcoming appointments were cancelled so the UI can tell the user.
    """
    t = get_or_404(db, therapist_id, active_only=True)
    result = db.execute(
        update(Appointment)
        .where(_future_live_appointments(t.id, clinic_now().replace(tzinfo=None)))
        .values(status=AppointmentStatus.CANCELLED)
    )
    t.is_active = False
    db.commit()
    return result.rowcount or 0


# --- per-date schedule overrides ---------------------------------------------


def list_overrides(db: Session, therapist_id: int, start: date, end: date) -> list[TherapistOverride]:
    get_or_404(db, therapist_id)
    return list(
        db.scalars(
            select(TherapistOverride)
            .where(
                TherapistOverride.therapist_id == therapist_id,
                TherapistOverride.date.between(start, end),
            )
            .order_by(TherapistOverride.date)
        )
    )


def _bookings_outside(db: Session, therapist_id: int, on: date, start: time | None, end: time | None) -> int:
    """Count live bookings on `on` that would fall outside [start, end) (all of them if off)."""
    stmt = select(func.count()).where(
        Appointment.therapist_id == therapist_id,
        Appointment.date == on,
        Appointment.status == AppointmentStatus.BOOKED,
    )
    if start is not None and end is not None:
        stmt = stmt.where(or_(Appointment.start_time < start, Appointment.end_time > end))
    return db.scalar(stmt) or 0


def set_override(db: Session, therapist_id: int, on: date, data: OverrideIn) -> TherapistOverride:
    get_or_404(db, therapist_id, active_only=True)
    if on < clinic_today():
        raise BusinessRuleError("Can't change the schedule for a past date")

    clashes = _bookings_outside(db, therapist_id, on, data.start_time, data.end_time)
    if clashes:
        raise ConflictError(
            f"{clashes} booked appointment(s) fall outside these hours on {on.isoformat()}. "
            "Reschedule or cancel them first."
        )

    override = db.scalar(
        select(TherapistOverride).where(
            TherapistOverride.therapist_id == therapist_id, TherapistOverride.date == on
        )
    )
    if override is None:
        override = TherapistOverride(therapist_id=therapist_id, date=on)
        db.add(override)
    override.is_off = data.is_off
    override.start_time = data.start_time
    override.end_time = data.end_time
    override.reason = data.reason
    db.commit()
    db.refresh(override)
    return override


def delete_override(db: Session, therapist_id: int, on: date) -> None:
    override = db.scalar(
        select(TherapistOverride).where(
            TherapistOverride.therapist_id == therapist_id, TherapistOverride.date == on
        )
    )
    if override is None:
        raise NotFoundError("No schedule override on that date")
    t = get_or_404(db, therapist_id)
    # Reverting to the weekly schedule must not strand existing bookings either.
    weekly = working_window(t.working_days, t.start_time, t.end_time, on)
    clashes = _bookings_outside(
        db, therapist_id, on, weekly.start if weekly else time(0), weekly.end if weekly else time(0)
    )
    if clashes:
        raise ConflictError(
            f"{clashes} booked appointment(s) on {on.isoformat()} fall outside the regular hours. "
            "Reschedule or cancel them first."
        )
    db.delete(override)
    db.commit()