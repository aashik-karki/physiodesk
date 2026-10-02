from datetime import date, datetime, time, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.config import clinic_today
from app.models import Appointment, AppointmentStatus, Patient, PaymentMethod
from tests.conftest import ADMIN, STAFF, auth_header, login

THERAPIST = {
    "full_name": "Dr. Sita Sharma",
    "specialty": "Sports rehab",
    "working_days": [1, 2, 3, 4, 5, 6, 7],
    "start_time": "09:00",
    "end_time": "17:00",
    "slot_minutes": 45,
}


@pytest.fixture
def admin(client: TestClient, users) -> dict[str, str]:
    return auth_header(login(client, ADMIN))


@pytest.fixture
def staff(client: TestClient, users) -> dict[str, str]:
    return auth_header(login(client, STAFF))


def make_therapist(client, admin, **overrides) -> dict:
    res = client.post("/api/therapists", json={**THERAPIST, **overrides}, headers=admin)
    assert res.status_code == 201, res.text
    return res.json()


def test_admin_creates_therapist_with_computed_roster_fields(client, admin):
    t = make_therapist(client, admin, working_days=[5, 1, 1, 3])
    assert t["working_days"] == [1, 3, 5]  # deduplicated and sorted
    assert t["weekly_hours"] == 24.0  # 3 days x 8h
    assert t["patients_today"] == 0
    assert t["is_active"] is True


def test_staff_can_read_but_not_manage_therapists(client, admin, staff):
    t = make_therapist(client, admin)
    assert client.get("/api/therapists", headers=staff).status_code == 200
    assert client.get(f"/api/therapists/{t['id']}", headers=staff).status_code == 200

    assert client.post("/api/therapists", json=THERAPIST, headers=staff).status_code == 403
    assert client.patch(f"/api/therapists/{t['id']}", json={"specialty": "x"}, headers=staff).status_code == 403
    assert client.delete(f"/api/therapists/{t['id']}", headers=staff).status_code == 403
    assert (
        client.put(f"/api/therapists/{t['id']}/overrides/{date.today()}", json={"is_off": True}, headers=staff).status_code
        == 403
    )


@pytest.mark.parametrize(
    "bad",
    [
        {"end_time": "08:00"},  # before start
        {"working_days": []},
        {"working_days": [0, 8]},
        {"slot_minutes": 5},
        {"full_name": "   "},
    ],
)
def test_therapist_validation(client, admin, bad):
    assert client.post("/api/therapists", json={**THERAPIST, **bad}, headers=admin).status_code == 422


def test_partial_update_rechecks_hours_against_stored_values(client, admin):
    t = make_therapist(client, admin)  # 09:00-17:00
    res = client.patch(f"/api/therapists/{t['id']}", json={"end_time": "08:30"}, headers=admin)
    assert res.status_code == 422
    res = client.patch(f"/api/therapists/{t['id']}", json={"end_time": "13:00"}, headers=admin)
    assert res.status_code == 200 and res.json()["weekly_hours"] == 28.0


def _book(db, therapist_id: int, on: date, start: time, patient_id: int) -> Appointment:
    end = (datetime.combine(on, start) + timedelta(minutes=45)).time()
    appt = Appointment(
        patient_id=patient_id, therapist_id=therapist_id, date=on, start_time=start,
        end_time=end, payment_method=PaymentMethod.CASH,
    )
    db.add(appt)
    db.commit()
    return appt


def _patient(db) -> Patient:
    from app.models import Gender

    p = Patient(full_name="Test Patient", phone="9800000000", age=30, gender=Gender.MALE, condition="Back pain")
    db.add(p)
    db.commit()
    return p


def test_delete_is_soft_and_cancels_only_upcoming_bookings(client, admin, db):
    t = make_therapist(client, admin)
    p = _patient(db)
    past = _book(db, t["id"], clinic_today() - timedelta(days=3), time(9), p.id)
    future = _book(db, t["id"], clinic_today() + timedelta(days=3), time(9), p.id)

    res = client.delete(f"/api/therapists/{t['id']}", headers=admin)
    assert res.status_code == 200
    assert res.json()["cancelled_appointments"] == 1

    db.expire_all()
    assert db.get(Appointment, past.id).status == AppointmentStatus.BOOKED  # history untouched
    assert db.get(Appointment, future.id).status == AppointmentStatus.CANCELLED

    # Gone from the roster, still retrievable for history, can't be edited.
    assert all(x["id"] != t["id"] for x in client.get("/api/therapists", headers=admin).json())
    assert client.get(f"/api/therapists/{t['id']}", headers=admin).json()["is_active"] is False
    assert client.patch(f"/api/therapists/{t['id']}", json={"specialty": "x"}, headers=admin).status_code == 404


def test_day_off_override_makes_therapist_off_duty(client, admin):
    t = make_therapist(client, admin)
    today = clinic_today().isoformat()
    assert client.get(f"/api/therapists/{t['id']}", headers=admin).json()["on_duty_today"] is True

    res = client.put(f"/api/therapists/{t['id']}/overrides/{today}", json={"is_off": True, "reason": "Leave"}, headers=admin)
    assert res.status_code == 200
    assert client.get(f"/api/therapists/{t['id']}", headers=admin).json()["on_duty_today"] is False

    # PUT again replaces rather than duplicating
    res = client.put(
        f"/api/therapists/{t['id']}/overrides/{today}",
        json={"is_off": False, "start_time": "12:00", "end_time": "15:00"},
        headers=admin,
    )
    assert res.status_code == 200
    overrides = client.get(f"/api/therapists/{t['id']}/overrides", headers=admin).json()
    assert len(overrides) == 1 and overrides[0]["start_time"] == "12:00:00"

    assert client.delete(f"/api/therapists/{t['id']}/overrides/{today}", headers=admin).status_code == 204
    assert client.get(f"/api/therapists/{t['id']}/overrides", headers=admin).json() == []


def test_override_that_would_strand_bookings_is_rejected(client, admin, db):
    t = make_therapist(client, admin)
    p = _patient(db)
    on = clinic_today() + timedelta(days=2)
    _book(db, t["id"], on, time(10), p.id)

    day_off = client.put(f"/api/therapists/{t['id']}/overrides/{on}", json={"is_off": True}, headers=admin)
    assert day_off.status_code == 409

    short_day = client.put(
        f"/api/therapists/{t['id']}/overrides/{on}",
        json={"is_off": False, "start_time": "13:00", "end_time": "17:00"},
        headers=admin,
    )
    assert short_day.status_code == 409

    covers_booking = client.put(
        f"/api/therapists/{t['id']}/overrides/{on}",
        json={"is_off": False, "start_time": "09:30", "end_time": "12:00"},
        headers=admin,
    )
    assert covers_booking.status_code == 200


def test_override_validation(client, admin):
    t = make_therapist(client, admin)
    on = clinic_today().isoformat()
    url = f"/api/therapists/{t['id']}/overrides/{on}"
    assert client.put(url, json={"is_off": False}, headers=admin).status_code == 422
    assert client.put(url, json={"is_off": False, "start_time": "15:00", "end_time": "10:00"}, headers=admin).status_code == 422
    past = (clinic_today() - timedelta(days=1)).isoformat()
    assert client.put(f"/api/therapists/{t['id']}/overrides/{past}", json={"is_off": True}, headers=admin).status_code == 422
