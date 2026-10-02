from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.config import clinic_today
from app.models import Package
from tests.conftest import ADMIN, STAFF, auth_header, login
from tests.test_patients import PATIENT


@pytest.fixture
def admin(client: TestClient, users) -> dict[str, str]:
    return auth_header(login(client, ADMIN))


@pytest.fixture
def staff(client: TestClient, users) -> dict[str, str]:
    return auth_header(login(client, STAFF))


@pytest.fixture
def patient(client, staff) -> dict:
    return client.post("/api/patients", json=PATIENT, headers=staff).json()


@pytest.fixture
def package(db) -> Package:
    pkg = Package(name="Back pain programme", session_count=6, price=Decimal("8000"))
    db.add(pkg)
    db.commit()
    return pkg


def create(client, headers, patient, expect=201, **body):
    res = client.post("/api/invoices", json={"patient_id": patient["id"], **body}, headers=headers)
    assert res.status_code == expect, res.text
    return res.json()


def test_total_is_amount_minus_discount(client, admin, patient):
    inv = create(client, admin, patient, service="Assessment", amount="2000", discount="250")
    assert Decimal(inv["total"]) == Decimal("1750")
    assert inv["number"] == f"INV-{inv['id']:05d}"
    assert inv["status"] == "due" and inv["paid_at"] is None
    assert inv["patient_name"] == PATIENT["full_name"]


def test_package_fills_service_and_amount(client, admin, patient, package):
    inv = create(client, admin, patient, package_id=package.id)
    assert inv["service"] == "Back pain programme"
    assert Decimal(inv["amount"]) == Decimal("8000")


def test_money_rules(client, admin, patient):
    create(client, admin, patient, expect=422, service="X", amount="100", discount="150")
    create(client, admin, patient, expect=422, service="X", amount="-5")
    create(client, admin, patient, expect=422, service="X")  # no amount, no package
    create(client, admin, patient, expect=422, service="X", amount="100", status="paid")  # paid needs method


def test_mark_paid_sets_paid_at_and_back(client, admin, patient):
    inv = create(client, admin, patient, service="Session", amount="1500")
    paid = client.patch(f"/api/invoices/{inv['id']}", json={"status": "paid", "payment_method": "cash"}, headers=admin).json()
    assert paid["status"] == "paid" and paid["paid_at"] is not None
    due = client.patch(f"/api/invoices/{inv['id']}", json={"status": "due"}, headers=admin).json()
    assert due["status"] == "due" and due["paid_at"] is None


def test_delete_voids_instead_of_erasing(client, admin, patient):
    inv = create(client, admin, patient, service="Session", amount="1500")
    res = client.delete(f"/api/invoices/{inv['id']}", headers=admin)
    assert res.status_code == 200 and res.json()["status"] == "void"
    assert client.get(f"/api/invoices/{inv['id']}", headers=admin).status_code == 200
    assert client.patch(f"/api/invoices/{inv['id']}", json={"amount": "1"}, headers=admin).status_code == 409


def test_staff_can_read_but_not_write(client, admin, staff, patient):
    inv = create(client, admin, patient, service="Session", amount="1500")
    assert client.get("/api/invoices", headers=staff).status_code == 200
    assert client.get(f"/api/invoices/{inv['id']}", headers=staff).status_code == 200
    create(client, staff, patient, expect=403, service="X", amount="1")
    assert client.patch(f"/api/invoices/{inv['id']}", json={"status": "paid", "payment_method": "cash"}, headers=staff).status_code == 403
    assert client.delete(f"/api/invoices/{inv['id']}", headers=staff).status_code == 403


def test_filters_search_and_summary(client, admin, patient):
    a = create(client, admin, patient, service="Assessment", amount="2000")
    create(client, admin, patient, service="Session", amount="1500", status="paid", payment_method="card")
    c = create(client, admin, patient, service="Session", amount="999")
    client.delete(f"/api/invoices/{c['id']}", headers=admin)

    body = client.get("/api/invoices", headers=admin).json()
    s = body["summary"]
    assert (Decimal(s["paid_total"]), Decimal(s["due_total"])) == (Decimal("1500"), Decimal("2000"))
    assert (s["paid_count"], s["due_count"], s["void_count"]) == (1, 1, 1)

    due = client.get("/api/invoices", params={"status": "due"}, headers=admin).json()
    assert [i["id"] for i in due["items"]] == [a["id"]]
    assert due["summary"]["paid_count"] == 1  # summary ignores the status filter (for the tabs)

    by_number = client.get("/api/invoices", params={"search": f"INV-{a['id']:05d}"}, headers=admin).json()
    assert [i["id"] for i in by_number["items"]] == [a["id"]]


def test_invoice_survives_patient_deletion(client, admin, staff, patient):
    inv = create(client, admin, patient, service="Session", amount="1500")
    assert client.delete(f"/api/patients/{patient['id']}", headers=staff).status_code == 204
    kept = client.get(f"/api/invoices/{inv['id']}", headers=admin).json()
    assert kept["patient_id"] is None and kept["patient_name"] == PATIENT["full_name"]


def test_appointment_can_only_be_billed_once(client, admin, staff, patient):
    from tests.test_therapists import THERAPIST
    t = client.post("/api/therapists", json=THERAPIST, headers=admin).json()
    day = (clinic_today() + timedelta(days=2)).isoformat()
    appt = client.post("/api/appointments", json={"patient_id": patient["id"], "therapist_id": t["id"], "date": day,
                                                 "start_time": "09:00", "payment_method": "cash"}, headers=staff).json()
    create(client, admin, patient, service="Session", amount="1500", appointment_id=appt["id"])
    res = create(client, admin, patient, expect=409, service="Session", amount="1500", appointment_id=appt["id"])
    assert "already billed" in res["detail"]
