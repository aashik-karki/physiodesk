"""Demo data for reviewers: users, packages, therapists, patients, appointments, invoices.

    python -m app.seed

Safe to run more than once: users and packages are created only if missing, and
the clinic data (therapists onwards) is only generated when no therapists exist yet.
Dates are relative to "today" in the clinic timezone, so the demo always looks live.
"""

import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import clinic_now, clinic_today
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    Appointment, AppointmentStatus, Gender, Invoice, InvoiceStatus, Package, Patient,
    PatientStatus, PaymentMethod, SessionType, Therapist, TherapistOverride, User, UserRole,
)
from app.services.availability import therapist_slots

USERS = [
    ("admin@physiodesk.dev", "Clinic Admin", UserRole.ADMIN, "Admin@123"),
    ("staff@physiodesk.dev", "Front Desk", UserRole.STAFF, "Staff@123"),
]

PACKAGES = [
    ("Single session", 1, "1500"),
    ("Assessment + 3 sessions", 4, "5500"),
    ("Back pain programme", 6, "8000"),
    ("Sports rehab · 10 sessions", 10, "13500"),
]

THERAPISTS = [
    # name, specialty, phone, email, ISO weekdays, start, end, slot minutes
    ("Dr. Sita Sharma", "Sports rehabilitation", "9801234567", "sita@physiodesk.dev", [1, 2, 3, 4, 5], time(9), time(17), 45),
    ("Dr. Bikash Thapa", "Orthopaedic physiotherapy", "9812345678", "bikash@physiodesk.dev", [1, 3, 4, 6, 7], time(10), time(18), 60),
    ("Anjali Gurung", "Neuro rehabilitation", "9823456789", "anjali@physiodesk.dev", [2, 3, 4, 5, 7], time(8), time(14), 30),
    ("Ramesh Adhikari", "Paediatric physiotherapy", "9834567890", None, [1, 2, 4, 5, 6], time(11), time(19), 45),
]

PATIENTS = [
    ("Ram Bahadur Thapa", 52, Gender.MALE, "Lalitpur", "Chronic lower back pain"),
    ("Anita Gurung", 34, Gender.FEMALE, "Kathmandu", "ACL reconstruction rehab"),
    ("Sunita Shrestha", 61, Gender.FEMALE, "Bhaktapur", "Frozen shoulder"),
    ("Rajesh Karki", 45, Gender.MALE, "Kathmandu", "Post-stroke mobility"),
    ("Pooja Maharjan", 28, Gender.FEMALE, "Lalitpur", "Tennis elbow"),
    ("Suman Tamang", 39, Gender.MALE, "Kirtipur", "Neck strain"),
    ("Gita KC", 57, Gender.FEMALE, "Kathmandu", "Knee osteoarthritis"),
    ("Hari Adhikari", 23, Gender.MALE, "Bhaktapur", "Ankle sprain"),
    ("Laxmi Bhandari", 48, Gender.FEMALE, "Lalitpur", "Plantar fasciitis"),
    ("Nabin Poudel", 31, Gender.MALE, "Kathmandu", "Sciatica"),
    ("Sarita Lama", 9, Gender.FEMALE, "Lalitpur", "Developmental coordination"),
    ("Kiran Basnet", 66, Gender.MALE, "Kathmandu", "Hip replacement rehab"),
    ("Manish Joshi", 41, Gender.MALE, "Banepa", "Rotator cuff tear"),
    ("Aarati Rai", 36, Gender.FEMALE, "Kathmandu", "Postnatal pelvic pain"),
    ("Dipesh Shrestha", 19, Gender.MALE, "Lalitpur", "Hamstring strain"),
    ("Bimala Thapa", 72, Gender.FEMALE, "Bhaktapur", "Balance and falls prevention"),
]


def seed_users(db: Session) -> None:
    for email, name, role, password in USERS:
        if not db.scalar(select(User).where(User.email == email)):
            db.add(User(email=email, full_name=name, role=role, password_hash=hash_password(password)))


def seed_packages(db: Session) -> None:
    for name, sessions, price in PACKAGES:
        if not db.scalar(select(Package).where(Package.name == name)):
            db.add(Package(name=name, session_count=sessions, price=Decimal(price)))


def seed_clinic(db: Session) -> None:
    """Therapists, patients, ~3 weeks of appointments and matching invoices."""
    rng = random.Random(42)  # deterministic: the same demo every time
    today, now = clinic_today(), clinic_now().replace(tzinfo=None)
    packages = list(db.scalars(select(Package).order_by(Package.price)))

    therapists = [
        Therapist(full_name=n, specialty=s, phone=ph, email=em, working_days=days, start_time=st, end_time=et, slot_minutes=m)
        for n, s, ph, em, days, st, et, m in THERAPISTS
    ]
    db.add_all(therapists)
    db.flush()

    patients = []
    for i, (name, age, gender, address, condition) in enumerate(PATIENTS):
        p = Patient(
            full_name=name, phone=f"98{rng.randint(10_000_000, 99_999_999)}", age=age, gender=gender,
            address=address, condition=condition, therapist_id=therapists[i % len(therapists)].id,
            package_id=rng.choice([None, *[pk.id for pk in packages]]),
            status=rng.choice([PatientStatus.ACTIVE] * 5 + [PatientStatus.ON_HOLD, PatientStatus.COMPLETED]),
            notes="Prefers morning sessions." if i == 0 else None,
        )
        p.created_at = datetime.combine(today - timedelta(days=30 - i), time(10))  # spread registrations
        patients.append(p)
    db.add_all(patients)
    db.flush()

    # One upcoming day off and one custom-hours day, so overrides are visible in the grid.
    db.add_all([
        TherapistOverride(therapist_id=therapists[0].id, date=today + timedelta(days=3), is_off=True, reason="Conference"),
        TherapistOverride(therapist_id=therapists[2].id, date=today + timedelta(days=1), is_off=False,
                          start_time=time(10), end_time=time(13), reason="Morning training"),
    ])
    db.flush()

    # Appointments from 14 days ago to 7 days ahead, filling ~45% of slots.
    busy: dict[tuple[int, date], list[tuple[time, time]]] = {}  # patient -> taken ranges that day
    appointments = []
    for offset in range(-14, 8):
        day = today + timedelta(days=offset)
        for t in therapists:
            override = db.scalar(select(TherapistOverride).where(TherapistOverride.therapist_id == t.id, TherapistOverride.date == day))
            for slot in therapist_slots(t, day, override):
                if rng.random() > 0.45:
                    continue
                candidates = [p for p in patients if p.status != PatientStatus.COMPLETED or offset < 0]
                p = rng.choice(candidates)
                taken = busy.setdefault((p.id, day), [])
                if any(slot.start < e and slot.end > s for s, e in taken):
                    continue  # this patient is already elsewhere at that time
                taken.append((slot.start, slot.end))
                starts_at = datetime.combine(day, slot.start)
                if starts_at >= now:
                    status = AppointmentStatus.BOOKED
                else:
                    status = rng.choices(
                        [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW, AppointmentStatus.CANCELLED],
                        weights=[85, 7, 8])[0]
                appointments.append(Appointment(
                    patient_id=p.id, therapist_id=t.id, date=day, start_time=slot.start, end_time=slot.end,
                    status=status, session_type=rng.choice([SessionType.TREATMENT] * 4 + [SessionType.ASSESSMENT, SessionType.FOLLOW_UP]),
                    payment_method=PaymentMethod.PACKAGE if p.package_id else rng.choice([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.DIGITAL_WALLET]),
                ))
    db.add_all(appointments)
    db.flush()

    # Invoice every completed pay-per-visit session; most are paid at the visit.
    by_id = {p.id: p for p in patients}
    for a in appointments:
        if a.status != AppointmentStatus.COMPLETED or a.payment_method == PaymentMethod.PACKAGE:
            continue
        p = by_id[a.patient_id]
        paid = rng.random() < 0.8
        end = datetime.combine(a.date, a.end_time)
        db.add(Invoice(
            patient_id=p.id, patient_name=p.full_name, appointment_id=a.id,
            service="Initial assessment" if a.session_type == SessionType.ASSESSMENT else "Physiotherapy session",
            amount=Decimal("2000") if a.session_type == SessionType.ASSESSMENT else Decimal("1500"),
            discount=Decimal("200") if rng.random() < 0.15 else Decimal("0"),
            status=InvoiceStatus.PAID if paid else InvoiceStatus.DUE,
            payment_method=a.payment_method if paid else None,
            issued_on=a.date,
            paid_at=end.replace(tzinfo=clinic_now().tzinfo) if paid else None,
        ))
    # Package purchases, invoiced up front.
    for p in patients:
        pkg = next((pk for pk in packages if pk.id == p.package_id), None)
        if pkg is None:
            continue
        paid = rng.random() < 0.7
        issued = p.created_at.date()
        db.add(Invoice(
            patient_id=p.id, patient_name=p.full_name, package_id=pkg.id, service=pkg.name, amount=pkg.price,
            status=InvoiceStatus.PAID if paid else InvoiceStatus.DUE,
            payment_method=rng.choice([PaymentMethod.BANK_TRANSFER, PaymentMethod.CARD]) if paid else None,
            issued_on=issued,
            paid_at=datetime.combine(issued, time(11), tzinfo=clinic_now().tzinfo) if paid else None,
        ))


def main() -> None:
    with SessionLocal() as db:
        seed_users(db)
        seed_packages(db)
        db.flush()
        if db.scalar(select(func.count()).select_from(Therapist)):
            print("Therapists already exist: skipping demo clinic data.")
        else:
            seed_clinic(db)
        db.commit()
        counts = {m.__tablename__: db.scalar(select(func.count()).select_from(m))
                  for m in (User, Therapist, Patient, Appointment, Invoice)}
    print("Seed complete:", ", ".join(f"{v} {k}" for k, v in counts.items()))
    print("Logins: admin@physiodesk.dev / Admin@123   staff@physiodesk.dev / Staff@123")


if __name__ == "__main__":
    main()
