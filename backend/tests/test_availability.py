"""Pure unit tests for slot generation — no database needed."""

from datetime import date, time
from types import SimpleNamespace

from app.services.availability import Window, generate_slots, weekly_minutes, working_window

MON_TO_FRI = [1, 2, 3, 4, 5]
MONDAY = date(2026, 10, 5)
SATURDAY = date(2026, 10, 10)


def override(is_off=False, start=None, end=None):
    return SimpleNamespace(is_off=is_off, start_time=start, end_time=end)


def test_slots_fill_the_window_back_to_back():
    slots = generate_slots(Window(time(9), time(11)), 30)
    assert [(s.start, s.end) for s in slots] == [
        (time(9, 0), time(9, 30)),
        (time(9, 30), time(10, 0)),
        (time(10, 0), time(10, 30)),
        (time(10, 30), time(11, 0)),
    ]


def test_trailing_partial_slot_is_dropped():
    # 9:00-10:00 with 45-minute slots -> only one full slot fits
    slots = generate_slots(Window(time(9), time(10)), 45)
    assert [(s.start, s.end) for s in slots] == [(time(9), time(9, 45))]


def test_no_window_means_no_slots():
    assert generate_slots(None, 30) == []


def test_non_working_weekday_is_off():
    assert working_window(MON_TO_FRI, time(9), time(17), SATURDAY) is None
    assert working_window(MON_TO_FRI, time(9), time(17), MONDAY) == Window(time(9), time(17))


def test_day_off_override_beats_weekly_schedule():
    assert working_window(MON_TO_FRI, time(9), time(17), MONDAY, override(is_off=True)) is None


def test_custom_hours_override_beats_weekly_schedule():
    ov = override(start=time(12), end=time(15))
    assert working_window(MON_TO_FRI, time(9), time(17), MONDAY, ov) == Window(time(12), time(15))


def test_override_can_open_a_normally_closed_day():
    ov = override(start=time(10), end=time(13))
    assert working_window(MON_TO_FRI, time(9), time(17), SATURDAY, ov) == Window(time(10), time(13))


def test_weekly_minutes():
    assert weekly_minutes(MON_TO_FRI, time(9), time(17)) == 5 * 8 * 60
    assert weekly_minutes([1, 1, 3], time(10), time(12, 30)) == 2 * 150  # duplicates ignored
