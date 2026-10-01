"""Working hours and slot generation.

Slots are never stored. For a given therapist and date:
  1. a per-date override wins (day off, or custom hours);
  2. otherwise the weekly schedule applies if the weekday is a working day;
  3. the resulting window is cut into back-to-back slots of `slot_minutes`.
A trailing remainder shorter than one slot is dropped.

The functions at the top are pure (no DB) so they're trivially unit-testable.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Therapist, TherapistOverride


@dataclass(frozen=True)
class Window:
    start: time
    end: time


@dataclass(frozen=True)
class Slot:
    start: time
    end: time


def working_window(
    working_days: list[int],
    start: time,
    end: time,
    on: date,
    override: TherapistOverride | None = None,
) -> Window | None:
    """The therapist's working window on `on`, or None if they're off."""
    if override is not None:
        if override.is_off:
            return None
        return Window(override.start_time, override.end_time)  # type: ignore[arg-type]
    if on.isoweekday() not in working_days:
        return None
    return Window(start, end)


def generate_slots(window: Window | None, slot_minutes: int) -> list[Slot]:
    if window is None or slot_minutes <= 0:
        return []
    step = timedelta(minutes=slot_minutes)
    anchor = date(2000, 1, 1)  # arbitrary day so we can do time arithmetic
    cursor = datetime.combine(anchor, window.start)
    limit = datetime.combine(anchor, window.end)
    slots: list[Slot] = []
    while cursor + step <= limit:
        slots.append(Slot(cursor.time(), (cursor + step).time()))
        cursor += step
    return slots


def weekly_minutes(working_days: list[int], start: time, end: time) -> int:
    per_day = (datetime.combine(date.min, end) - datetime.combine(date.min, start)).seconds // 60
    return per_day * len(set(working_days))


# --- DB-backed helpers -------------------------------------------------------


def get_override(db: Session, therapist_id: int, on: date) -> TherapistOverride | None:
    return db.scalar(
        select(TherapistOverride).where(
            TherapistOverride.therapist_id == therapist_id, TherapistOverride.date == on
        )
    )


def overrides_for_date(db: Session, on: date) -> dict[int, TherapistOverride]:
    rows = db.scalars(select(TherapistOverride).where(TherapistOverride.date == on))
    return {o.therapist_id: o for o in rows}


def therapist_slots(
    therapist: Therapist, on: date, override: TherapistOverride | None
) -> list[Slot]:
    window = working_window(
        therapist.working_days, therapist.start_time, therapist.end_time, on, override
    )
    return generate_slots(window, therapist.slot_minutes)