"""Demo data. Safe to run more than once: existing rows are left alone.

    python -m app.seed
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Package, User, UserRole

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


def seed_users(db: Session) -> None:
    for email, name, role, password in USERS:
        if not db.scalar(select(User).where(User.email == email)):
            db.add(User(email=email, full_name=name, role=role, password_hash=hash_password(password)))


def seed_packages(db: Session) -> None:
    for name, sessions, price in PACKAGES:
        if not db.scalar(select(Package).where(Package.name == name)):
            db.add(Package(name=name, session_count=sessions, price=Decimal(price)))


def main() -> None:
    with SessionLocal() as db:
        seed_users(db)
        seed_packages(db)
        db.commit()
    print("Seed complete. Logins: admin@physiodesk.dev / Admin@123, staff@physiodesk.dev / Staff@123")


if __name__ == "__main__":
    main()