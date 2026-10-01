"""Booking, rescheduling, status changes and the day schedule grid.

Booking rules (checked here with clear messages; the database exclusion
constraints are the backstop for races):
  - the therapist must be active and the start time must be one of their slots
    on that date (weekly hours, or that date's override);
  - the appointment can't start in the past;
  - neither the therapist nor the patient may already have an overlapping live
    appointment.
"""

from datetime import date, datetime, time

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import clinic_now
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.models import Appointment, AppointmentStatus, Patient, Therapist
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentUpdate,
    DaySchedule,
    ScheduleTherapist,
    SlotAppointment,
    SlotOut,
    TherapistDay,
)
from app.schemas.common import Page, PageParams
from app.services.availability import get_override, overrides_for_date, therapist_slots, working_window

TERMINAL_FROM_BOOKED = {
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
}


def _now() -> datetime:
    return clinic_now().replace(tzinfo=None)


def _fmt(t: time) -> str:
    return t.strftime("%H:%M")


def get_or_404(db: Session, appointment_id: int) -> Appointment:
    appt = db.scalar(
        select(Appointment)
        .options(joinedload(Appointment.patient), joinedload(Appointment.therapist))
        .where(Appointment.id == appointment_id)
    )
    if appt is None:
        raise NotFoundError("Appointment not found")
    return appt


def _active_therapist(db: Session, therapist_id: int) -> Therapist:
    t = db.get(Therapist, therapist_id)
    if t is None or not t.is_active:
        raise BusinessRuleError("Therapist doesn't exist or is no longer active")
    return t


def _slot_end(db: Session, therapist: Therapist, on: date, start: time) -> time:
    """Return the slot's end time, or raise if `start` isn't one of the therapist's slots."""
    override = get_override(db, therapist.id, on)
    slots = therapist_slots(therapist, on, override)
    if not slots:
        raise BusinessRuleError(f"{therapist.full_name} is not working on {on.isoformat()}")
    for slot in slots:
        if slot.start == start:
            return slot.end
    raise BusinessRuleError(
        f"{_fmt(start)} isn't one of {therapist.full_name}'s slots on {on.isoformat()} "
        f"({_fmt(slots[0].start)}-{_fmt(slots[-1].end)}, every {therapist.slot_minutes} min)"
    )


def _ensure_future(on: date, start: time) -> None:
    if datetime.combine(on, start) < _now():
        raise BusinessRuleError("Can't book an appointment in the past")


def _ensure_no_overlap(
    db: Session,
    *,
    therapist: Therapist,
    patient_id: int,
    on: date,
    start: time,
    end: time,
    exclude_id: int | None = None,
) -> None:
    clash_q = (
        select(Appointment)
        .options(joinedload(Appointment.patient))
        .where(
            Appointment.date == on,
            Appointment.status != AppointmentStatus.CANCELLED,
            Appointment.start_time < end,
            Appointment.end_time > start,
            or_(Appointment.therapist_id == therapist.id, Appointment.patient_id == patient_id),
        )
    )
    if exclude_id is not None:
        clash_q = clash_q.where(Appointment.id != exclude_id)
    for clash in db.scalars(clash_q):
        window = f"{_fmt(clash.start_time)}-{_fmt(clash.end_time)}"
        if clash.therapist_id == therapist.id:
            raise ConflictError(f"{therapist.full_name} is already booked {window} ({clash.patient.full_name}).")
        raise ConflictError(f"{clash.patient.full_name} already has an appointment {window} that day.")


def book(db: Session, data: AppointmentCreate) -> Appointment:
    patient = db.get(Patient, data.patient_id)
    if patient is None:
        raise BusinessRuleError("Patient doesn't exist")
    therapist = _active_therapist(db, data.therapist_id)
    end = _slot_end(db, therapist, data.date, data.start_time)
    _ensure_future(data.date, data.start_time)
    _ensure_no_overlap(
        db, therapist=therapist, patient_id=patient.id, on=data.date, start=data.start_time, end=end
    )
    appt = Appointment(**data.model_dump(), end_time=end, status=AppointmentStatus.BOOKED)
    db.add(appt)
    db.commit()
    return get_or_404(db, appt.id)


def update(db: Session, appointment_id: int, data: AppointmentUpdate) -> Appointment:
    appt = get_or_404(db, appointment_id)
    changes = data.model_dump(exclude_unset=True)

    for field in ("therapist_id", "date", "start_time", "status", "payment_method", "session_type"):
        if field in changes and changes[field] is None:
            raise BusinessRuleError(f"{field} cannot be empty")

    moving = any(
        f in changes and changes[f] != getattr(appt, f) for f in ("therapist_id", "date", "start_time")
    )
    if moving:
        if appt.status != AppointmentStatus.BOOKED:
            raise ConflictError(f"Only booked appointments can be rescheduled (this one is {appt.status.value}).")
        therapist = _active_therapist(db, changes.get("therapist_id", appt.therapist_id))
        on = changes.get("date", appt.date)
        start = changes.get("start_time", appt.start_time)
        end = _slot_end(db, therapist, on, start)
        _ensure_future(on, start)
        _ensure_no_overlap(
            db, therapist=therapist, patient_id=appt.patient_id, on=on, start=start, end=end,
            exclude_id=appt.id,
        )
        appt.therapist_id, appt.date, appt.start_time, appt.end_time = therapist.id, on, start, end

    new_status = changes.get("status")
    if new_status is not None and new_status != appt.status:
        if appt.status != AppointmentStatus.BOOKED or new_status not in TERMINAL_FROM_BOOKED:
            raise ConflictError(
                f"Can't change status from {appt.status.value} to {new_status.value}. "
                "Book a new appointment instead."
            )
        started = datetime.combine(appt.date, appt.start_time) <= _now()
        if new_status in (AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW) and not started:
            raise BusinessRuleError(f"Can't mark an appointment as {new_status.value} before it starts")
        appt.status = new_status

    for field in ("payment_method", "session_type", "notes"):
        if field in changes:
            setattr(appt, field, changes[field])

    db.commit()
    db.expire(appt)
    return get_or_404(db, appt.id)


def list_appointments(
    db: Session,
    page: PageParams,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    therapist_id: int | None = None,
    patient_id: int | None = None,
    status: AppointmentStatus | None = None,
    newest_first: bool = True,
) -> Page[AppointmentOut]:
    filters = []
    if date_from:
        filters.append(Appointment.date >= date_from)
    if date_to:
        filters.append(Appointment.date <= date_to)
    if therapist_id is not None:
        filters.append(Appointment.therapist_id == therapist_id)
    if patient_id is not None:
        filters.append(Appointment.patient_id == patient_id)
    if status is not None:
        filters.append(Appointment.status == status)

    order = (
        (Appointment.date.desc(), Appointment.start_time.desc())
        if newest_first
        else (Appointment.date.asc(), Appointment.start_time.asc())
    )
    total = db.scalar(select(func.count()).select_from(Appointment).where(*filters)) or 0
    rows = db.scalars(
        select(Appointment)
        .options(joinedload(Appointment.patient), joinedload(Appointment.therapist))
        .where(*filters)
        .order_by(*order)
        .offset(page.offset)
        .limit(page.page_size)
    )
    return Page[AppointmentOut](
        items=[AppointmentOut.model_validate(a) for a in rows],
        total=total,
        page=page.page,
        page_size=page.page_size,
    )


# --- day schedule grid -------------------------------------------------------------


def day_schedule(db: Session, on: date, therapist_id: int | None = None) -> DaySchedule:
    live = (
        select(Appointment)
        .options(joinedload(Appointment.patient))
        .where(Appointment.date == on, Appointment.status != AppointmentStatus.CANCELLED)
    )
    if therapist_id is not None:
        live = live.where(Appointment.therapist_id == therapist_id)
    appts_by_therapist: dict[int, list[Appointment]] = {}
    for a in db.scalars(live):
        appts_by_therapist.setdefault(a.therapist_id, []).append(a)

    # Active therapists, plus removed ones who still have appointments that day (history).
    t_q = select(Therapist).where(
        or_(Therapist.is_active.is_(True), Therapist.id.in_(list(appts_by_therapist) or [0]))
    )
    if therapist_id is not None:
        t_q = t_q.where(Therapist.id == therapist_id)
    therapists = list(db.scalars(t_q.order_by(Therapist.full_name)))

    overrides = overrides_for_date(db, on)
    now = _now()
    days = [
        _therapist_day(t, on, overrides.get(t.id), appts_by_therapist.get(t.id, []), now)
        for t in therapists
    ]
    return DaySchedule(date=on, therapists=days)


def _therapist_day(therapist, on, override, appointments, now: datetime) -> TherapistDay:
    window = working_window(therapist.working_days, therapist.start_time, therapist.end_time, on, override)
    slots = therapist_slots(therapist, on, override) if therapist.is_active else []
    by_start = {a.start_time: a for a in appointments}

    out: list[SlotOut] = []
    for s in slots:
        appt = by_start.pop(s.start, None)
        if appt is not None:
            out.append(SlotOut(start=s.start, end=s.end, state="booked", appointment=_brief(appt)))
        else:
            state = "past" if datetime.combine(on, s.start) < now else "open"
            out.append(SlotOut(start=s.start, end=s.end, state=state))
    # Bookings that no longer line up with a slot (hours changed after booking).
    for appt in by_start.values():
        out.append(
            SlotOut(start=appt.start_time, end=appt.end_time, state="booked", out_of_hours=True,
                    appointment=_brief(appt))
        )
    out.sort(key=lambda s: s.start)

    return TherapistDay(
        therapist=ScheduleTherapist.model_validate(therapist, from_attributes=True),
        is_off=window is None,
        off_reason=override.reason if override is not None and override.is_off else None,
        start_time=window.start if window else None,
        end_time=window.end if window else None,
        has_override=override is not None,
        slots=out,
        booked_count=sum(1 for s in out if s.state == "booked"),
        open_count=sum(1 for s in out if s.state == "open"),
    )


def _brief(a: Appointment) -> SlotAppointment:
    return SlotAppointment(
        id=a.id, patient_id=a.patient_id, patient_name=a.patient.full_name,
        status=a.status, session_type=a.session_type,
    )