from datetime import date, datetime

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from app.core.config import clinic_now, clinic_today
from app.core.errors import BusinessRuleError, NotFoundError
from app.models import Appointment, AppointmentStatus, Therapist
from app.schemas.therapist import TherapistCreate, TherapistOut, TherapistUpdate

REQUIRED = {"full_name", "specialty", "working_days", "start_time", "end_time", "slot_minutes"}


def get_or_404(db: Session, therapist_id: int, *, active_only: bool = False) -> Therapist:
    therapist = db.get(Therapist, therapist_id)
    if therapist is None or (active_only and not therapist.is_active):
        raise NotFoundError("Therapist not found")
    return therapist


def _patients_today(db: Session, today: date) -> dict[int, int]:
    """{therapist_id: distinct patients with a booked/completed appointment today}"""
    rows = db.execute(
        select(Appointment.therapist_id, func.count(func.distinct(Appointment.patient_id)))
        .where(
            Appointment.date == today,
            Appointment.status.in_([AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED]),
        )
        .group_by(Appointment.therapist_id)
    )
    return dict(rows.all())


def _to_out(t: Therapist, today: date, counts: dict[int, int]) -> TherapistOut:
    minutes_per_day = (
        datetime.combine(today, t.end_time) - datetime.combine(today, t.start_time)
    ).seconds // 60
    return TherapistOut(
        id=t.id, full_name=t.full_name, specialty=t.specialty, phone=t.phone, email=t.email,
        working_days=t.working_days, start_time=t.start_time, end_time=t.end_time,
        slot_minutes=t.slot_minutes, is_active=t.is_active,
        weekly_hours=round(minutes_per_day * len(t.working_days) / 60, 1),
        patients_today=counts.get(t.id, 0),
        # Upgraded in the Schedule feature to also respect one-off days off.
        on_duty_today=t.is_active and today.isoweekday() in t.working_days,
    )


def list_therapists(db: Session, search: str | None = None, include_inactive: bool = False) -> list[TherapistOut]:
    stmt = select(Therapist).order_by(Therapist.full_name)
    if not include_inactive:
        stmt = stmt.where(Therapist.is_active.is_(True))
    if search and search.strip():
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Therapist.full_name.ilike(like), Therapist.specialty.ilike(like)))
    today = clinic_today()
    counts = _patients_today(db, today)
    return [_to_out(t, today, counts) for t in db.scalars(stmt)]


def get_therapist(db: Session, therapist_id: int) -> TherapistOut:
    t = get_or_404(db, therapist_id)
    today = clinic_today()
    return _to_out(t, today, _patients_today(db, today))


def create_therapist(db: Session, data: TherapistCreate) -> TherapistOut:
    t = Therapist(**data.model_dump())
    db.add(t)
    db.commit()
    return get_therapist(db, t.id)


def update_therapist(db: Session, therapist_id: int, data: TherapistUpdate) -> TherapistOut:
    t = get_or_404(db, therapist_id, active_only=True)
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is None and field in REQUIRED:
            raise BusinessRuleError(f"{field} cannot be empty")
        setattr(t, field, value)
    # Re-check against the merged values (e.g. only end_time was sent).
    if t.end_time <= t.start_time:
        raise BusinessRuleError("end_time must be after start_time")
    db.commit()
    return get_therapist(db, t.id)


def delete_therapist(db: Session, therapist_id: int) -> int:
    """Soft delete: hide the therapist, cancel their UPCOMING bookings, keep history.

    Returns how many upcoming appointments were cancelled.
    """
    t = get_or_404(db, therapist_id, active_only=True)
    now = clinic_now().replace(tzinfo=None)
    upcoming = and_(
        Appointment.therapist_id == t.id,
        Appointment.status == AppointmentStatus.BOOKED,
        or_(
            Appointment.date > now.date(),
            and_(Appointment.date == now.date(), Appointment.start_time >= now.time()),
        ),
    )
    result = db.execute(update(Appointment).where(upcoming).values(status=AppointmentStatus.CANCELLED))
    t.is_active = False
    db.commit()
    return result.rowcount or 0