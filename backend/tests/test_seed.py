from sqlalchemy import func, select

from app.models import Appointment, AppointmentStatus, Invoice, Patient, Therapist, User
from app.seed import seed_clinic, seed_packages, seed_users


def test_seed_builds_a_consistent_demo_clinic(db):
    """The seed must satisfy every DB constraint (no overlapping bookings, valid money)."""
    seed_users(db)
    seed_packages(db)
    db.flush()
    seed_clinic(db)
    db.commit()

    count = lambda m: db.scalar(select(func.count()).select_from(m))  # noqa: E731
    assert count(User) == 2 and count(Therapist) == 4 and count(Patient) == 16
    assert count(Appointment) > 100 and count(Invoice) > 20
    # there is something upcoming to look at in the demo
    assert db.scalar(select(func.count()).where(Appointment.status == AppointmentStatus.BOOKED)) > 0
