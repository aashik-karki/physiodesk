from datetime import time, timedelta
from decimal import Decimal

from app.core.config import clinic_now, clinic_today
from app.models import Appointment, AppointmentStatus, Invoice, InvoiceStatus, PaymentMethod
from tests.test_invoices import admin, patient, staff  # noqa: F401  (fixtures)
from tests.test_therapists import THERAPIST


def test_dashboard_numbers(client, admin, staff, patient, db):  # noqa: F811
    t = client.post("/api/therapists", json=THERAPIST, headers=admin).json()
    today = clinic_today()
    # two appointments today for the same patient -> counts as ONE patient
    for start, end, st in [(time(9), time(9, 45), AppointmentStatus.COMPLETED),
                           (time(10, 30), time(11, 15), AppointmentStatus.CANCELLED)]:
        db.add(Appointment(patient_id=patient["id"], therapist_id=t["id"], date=today, start_time=start,
                           end_time=end, status=st, payment_method=PaymentMethod.CASH))
    now = clinic_now()
    db.add_all([
        Invoice(patient_id=patient["id"], patient_name="x", service="a", amount=Decimal("1500"), issued_on=today,
                status=InvoiceStatus.PAID, payment_method=PaymentMethod.CASH, paid_at=now),
        Invoice(patient_id=patient["id"], patient_name="x", service="b", amount=Decimal("700"), issued_on=today,
                status=InvoiceStatus.PAID, payment_method=PaymentMethod.CASH, paid_at=now - timedelta(days=1)),
        Invoice(patient_id=patient["id"], patient_name="x", service="c", amount=Decimal("900"), issued_on=today,
                status=InvoiceStatus.DUE),
    ])
    db.commit()

    d = client.get("/api/dashboard", headers=staff).json()
    s = d["stats"]
    assert s["patients_today"] == 1                       # cancelled doesn't count
    assert s["therapists_on_duty"] == 1                   # works every day
    assert Decimal(s["revenue_today"]) == Decimal("1500")  # yesterday's payment excluded
    assert Decimal(s["outstanding_due"]) == Decimal("900")
    assert s["appointments_completed"] == 1
    assert len(d["capacity"]) == 1 and d["recent_patients"][0]["id"] == patient["id"]


def test_dashboard_requires_login(client, users):
    assert client.get("/api/dashboard").status_code == 401
