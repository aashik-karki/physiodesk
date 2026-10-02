from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.models import Package
from tests.conftest import ADMIN, STAFF, auth_header, login
from tests.test_therapists import THERAPIST

PATIENT = {
    "full_name": "Ram Bahadur Thapa",
    "phone": "+977 980-1234567",
    "age": 45,
    "gender": "male",
    "address": "Lalitpur",
    "condition": "Lower back pain",
}


@pytest.fixture
def staff(client: TestClient, users) -> dict[str, str]:
    return auth_header(login(client, STAFF))


@pytest.fixture
def admin(client: TestClient, users) -> dict[str, str]:
    return auth_header(login(client, ADMIN))


@pytest.fixture
def therapist(client, admin) -> dict:
    return client.post("/api/therapists", json=THERAPIST, headers=admin).json()


@pytest.fixture
def package(db) -> Package:
    pkg = Package(name="10-session rehab", session_count=10, price=Decimal("15000"))
    db.add(pkg)
    db.commit()
    return pkg


def create(client, headers, **overrides) -> dict:
    res = client.post("/api/patients", json={**PATIENT, **overrides}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_all_patient_routes_require_auth(client, users):
    assert client.get("/api/patients").status_code == 401
    assert client.post("/api/patients", json=PATIENT).status_code == 401
    assert client.get("/api/packages").status_code == 401


def test_staff_full_crud(client, staff, therapist, package):
    p = create(client, staff, therapist_id=therapist["id"], package_id=package.id)
    assert p["status"] == "active"
    assert p["therapist"] == {"id": therapist["id"], "full_name": therapist["full_name"]}
    assert p["package"]["name"] == "10-session rehab"

    res = client.patch(f"/api/patients/{p['id']}", json={"status": "on_hold", "age": 46}, headers=staff)
    assert res.status_code == 200
    assert res.json()["status"] == "on_hold" and res.json()["age"] == 46
    assert res.json()["full_name"] == PATIENT["full_name"]  # untouched fields preserved

    res = client.patch(f"/api/patients/{p['id']}", json={"therapist_id": None}, headers=staff)
    assert res.json()["therapist"] is None  # explicit null unassigns

    assert client.delete(f"/api/patients/{p['id']}", headers=staff).status_code == 204
    assert client.get(f"/api/patients/{p['id']}", headers=staff).status_code == 404


@pytest.mark.parametrize(
    "bad",
    [
        {"phone": "abc"},
        {"age": -1},
        {"age": 200},
        {"gender": "unknown"},
        {"full_name": ""},
        {"condition": "  "},
    ],
)
def test_patient_validation(client, staff, bad):
    assert client.post("/api/patients", json={**PATIENT, **bad}, headers=staff).status_code == 422


def test_cannot_assign_missing_or_inactive_therapist(client, staff, admin, therapist):
    assert client.post("/api/patients", json={**PATIENT, "therapist_id": 9999}, headers=staff).status_code == 422
    client.delete(f"/api/therapists/{therapist['id']}", headers=admin)
    assert client.post("/api/patients", json={**PATIENT, "therapist_id": therapist["id"]}, headers=staff).status_code == 422


def test_required_fields_cannot_be_nulled_on_update(client, staff):
    p = create(client, staff)
    assert client.patch(f"/api/patients/{p['id']}", json={"full_name": None}, headers=staff).status_code == 422


def test_search_by_name_and_by_phone_ignoring_formatting(client, staff):
    create(client, staff, full_name="Anita Gurung", phone="9812345678")
    create(client, staff, full_name="Bikash Rai", phone="+977-9841-000111")

    by_name = client.get("/api/patients", params={"search": "anita"}, headers=staff).json()
    assert [p["full_name"] for p in by_name["items"]] == ["Anita Gurung"]

    by_phone = client.get("/api/patients", params={"search": "9841000"}, headers=staff).json()
    assert [p["full_name"] for p in by_phone["items"]] == ["Bikash Rai"]


def test_filter_by_therapist_and_status(client, staff, therapist):
    create(client, staff, full_name="A", therapist_id=therapist["id"])
    create(client, staff, full_name="B", therapist_id=therapist["id"], status="completed")
    create(client, staff, full_name="C")

    by_t = client.get("/api/patients", params={"therapist_id": therapist["id"]}, headers=staff).json()
    assert {p["full_name"] for p in by_t["items"]} == {"A", "B"}

    both = client.get(
        "/api/patients", params={"therapist_id": therapist["id"], "status": "completed"}, headers=staff
    ).json()
    assert [p["full_name"] for p in both["items"]] == ["B"]


def test_pagination_newest_first(client, staff):
    for i in range(5):
        create(client, staff, full_name=f"P{i}")
    page1 = client.get("/api/patients", params={"page": 1, "page_size": 2}, headers=staff).json()
    page3 = client.get("/api/patients", params={"page": 3, "page_size": 2}, headers=staff).json()
    assert page1["total"] == 5
    assert [p["full_name"] for p in page1["items"]] == ["P4", "P3"]
    assert [p["full_name"] for p in page3["items"]] == ["P0"]
    assert client.get("/api/patients", params={"page_size": 500}, headers=staff).status_code == 422


def test_packages_list(client, staff, package):
    res = client.get("/api/packages", headers=staff)
    assert res.status_code == 200
    assert res.json()[0]["name"] == "10-session rehab"
