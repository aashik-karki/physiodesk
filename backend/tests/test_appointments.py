from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.config import clinic_today
from tests.conftest import ADMIN, STAFF, auth_header, login
from tests.test_patients import PATIENT
from tests.test_therapists import THERAPIST  # 09:00-17:00 every day, 45-min slots

FUTURE = (clinic_today() + timedelta(days=3)).isoformat()


@pytest.fixture
def staff(client: TestClient, users) -> dict[str, str]:
    return auth_header(login(client, STAFF))


@pytest.fixture
def admin(client: TestClient, users) -> dict[str, str]:
    return auth_header(login(client, ADMIN))


@pytest.fixture
def world(client, admin, staff):
    """Two therapists (45-min and 30-min slots) and two patients."""
    t1 = client.post("/api/therapists", json=THERAPIST, headers=admin).json()
    t2 = client.post(
        "/api/therapists", json={**THERAPIST, "full_name": "Dr. Hari", "slot_minutes": 30}, headers=admin
    ).json()
    p1 = client.post("/api/patients", json=PATIENT, headers=staff).json()
    p2 = client.post("/api/patients", json={**PATIENT, "full_name": "Gita KC"}, headers=staff).json()
    return {"t1": t1, "t2": t2, "p1": p1, "p2": p2}


def book(client, headers, therapist, patient, start="09:00", on=FUTURE, expect=201, **extra):
    res = client.post(
        "/api/appointments",
        json={
            "patient_id": patient["id"], "therapist_id": therapist["id"], "date": on,
            "start_time": start, "payment_method": "cash", **extra,
        },
        headers=headers,
    )
    assert res.status_code == expect, res.text
    return res.json()


def test_booking_derives_end_time_from_slot_length(client, staff, world):
    a = book(client, staff, world["t1"], world["p1"], "09:45")
    assert (a["start_time"], a["end_time"]) == ("09:45:00", "10:30:00")
    assert a["status"] == "booked"
    assert a["patient"]["full_name"] == PATIENT["full_name"]


def test_start_must_be_one_of_the_therapists_slots(client, staff, world):
    res = book(client, staff, world["t1"], world["p1"], "09:10", expect=422)
    assert "isn't one of" in res["detail"]
    book(client, staff, world["t1"], world["p1"], "08:00", expect=422)  # before hours
    book(client, staff, world["t1"], world["p1"], "16:30", expect=422)  # partial slot dropped


def test_cannot_double_book_a_therapist(client, staff, world):
    book(client, staff, world["t1"], world["p1"], "10:30")
    res = book(client, staff, world["t1"], world["p2"], "10:30", expect=409)
    assert "already booked" in res["detail"]


def test_cannot_double_book_a_patient_even_with_partial_overlap(client, staff, world):
    book(client, staff, world["t1"], world["p1"], "09:00")  # 09:00-09:45 with t1
    # t2 has 30-min slots: 09:30-10:00 overlaps; 09:00-09:30 overlaps; 10:00 is fine
    book(client, staff, world["t2"], world["p1"], "09:30", expect=409)
    book(client, staff, world["t2"], world["p1"], "09:00", expect=409)
    book(client, staff, world["t2"], world["p1"], "10:00")


def test_cancelled_appointment_frees_the_slot(client, staff, world):
    a = book(client, staff, world["t1"], world["p1"], "11:15")
    res = client.patch(f"/api/appointments/{a['id']}", json={"status": "cancelled"}, headers=staff)
    assert res.status_code == 200
    book(client, staff, world["t1"], world["p2"], "11:15")


def test_cannot_book_in_the_past_or_on_a_day_off(client, admin, staff, world):
    yesterday = (clinic_today() - timedelta(days=1)).isoformat()
    book(client, staff, world["t1"], world["p1"], "09:00", on=yesterday, expect=422)

    client.put(f"/api/therapists/{world['t1']['id']}/overrides/{FUTURE}", json={"is_off": True}, headers=admin)
    res = book(client, staff, world["t1"], world["p1"], "09:00", expect=422)
    assert "not working" in res["detail"]


def test_custom_hours_override_changes_bookable_slots(client, admin, staff, world):
    client.put(
        f"/api/therapists/{world['t1']['id']}/overrides/{FUTURE}",
        json={"is_off": False, "start_time": "13:00", "end_time": "15:00"},
        headers=admin,
    )
    book(client, staff, world["t1"], world["p1"], "09:00", expect=422)
    book(client, staff, world["t1"], world["p1"], "13:45")


def test_reschedule_checks_the_new_slot_and_ignores_itself(client, staff, world):
    a = book(client, staff, world["t1"], world["p1"], "09:00")
    book(client, staff, world["t1"], world["p2"], "09:45")

    # into p2's slot -> conflict
    res = client.patch(f"/api/appointments/{a['id']}", json={"start_time": "09:45"}, headers=staff)
    assert res.status_code == 409
    # same slot, different notes -> fine (doesn't clash with itself)
    res = client.patch(f"/api/appointments/{a['id']}", json={"start_time": "09:00", "notes": "x"}, headers=staff)
    assert res.status_code == 200
    # move to another therapist and time
    res = client.patch(
        f"/api/appointments/{a['id']}",
        json={"therapist_id": world["t2"]["id"], "start_time": "14:30"},
        headers=staff,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["therapist"]["id"] == world["t2"]["id"]
    assert (body["start_time"], body["end_time"]) == ("14:30:00", "15:00:00")


def test_status_rules(client, staff, world):
    a = book(client, staff, world["t1"], world["p1"], "09:00")
    # can't complete a future appointment
    assert client.patch(f"/api/appointments/{a['id']}", json={"status": "completed"}, headers=staff).status_code == 422
    # cancel, then can't reinstate or reschedule
    client.patch(f"/api/appointments/{a['id']}", json={"status": "cancelled"}, headers=staff)
    assert client.patch(f"/api/appointments/{a['id']}", json={"status": "booked"}, headers=staff).status_code == 409
    assert client.patch(f"/api/appointments/{a['id']}", json={"start_time": "10:30"}, headers=staff).status_code == 409


def test_day_schedule_grid(client, admin, staff, world):
    book(client, staff, world["t1"], world["p1"], "09:00")
    client.put(f"/api/therapists/{world['t2']['id']}/overrides/{FUTURE}", json={"is_off": True, "reason": "Leave"}, headers=admin)

    grid = client.get("/api/schedule", params={"date": FUTURE}, headers=staff).json()
    days = {d["therapist"]["id"]: d for d in grid["therapists"]}

    t1 = days[world["t1"]["id"]]
    assert t1["is_off"] is False
    assert len(t1["slots"]) == 10  # 8h / 45min -> 10 full slots
    first = t1["slots"][0]
    assert first["state"] == "booked" and first["appointment"]["patient_name"] == PATIENT["full_name"]
    assert t1["booked_count"] == 1 and t1["open_count"] == 9

    t2 = days[world["t2"]["id"]]
    assert t2["is_off"] is True and t2["off_reason"] == "Leave" and t2["slots"] == []


def test_availability_lists_only_open_slots(client, staff, world):
    book(client, staff, world["t1"], world["p1"], "09:45")
    slots = client.get(
        "/api/schedule/availability",
        params={"therapist_id": world["t1"]["id"], "date": FUTURE},
        headers=staff,
    ).json()
    starts = [s["start"] for s in slots]
    assert "09:45:00" not in starts and "09:00:00" in starts and len(starts) == 9


def test_patient_session_history_via_filter(client, staff, world):
    book(client, staff, world["t1"], world["p1"], "09:00")
    book(client, staff, world["t2"], world["p1"], "15:00")
    book(client, staff, world["t1"], world["p2"], "12:00")
    res = client.get("/api/appointments", params={"patient_id": world["p1"]["id"]}, headers=staff).json()
    assert res["total"] == 2
    assert [a["start_time"] for a in res["items"]] == ["15:00:00", "09:00:00"]  # newest first


def test_database_rejects_overlap_even_if_service_check_is_bypassed(client, staff, world, monkeypatch):
    """Simulates two requests racing past the service-level check at the same moment."""
    from app.services import appointments as svc

    monkeypatch.setattr(svc, "_ensure_no_overlap", lambda *a, **k: None)
    book(client, staff, world["t1"], world["p1"], "09:00")
    res = book(client, staff, world["t1"], world["p2"], "09:00", expect=409)
    assert res["detail"] == "The therapist already has an appointment at this time."
