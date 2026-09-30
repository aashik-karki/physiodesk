"""Usage: python -m app.create_user admin@physiodesk.dev "Admin User" admin"""
import getpass
import sys

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User, UserRole

email, name, role = sys.argv[1].lower(), sys.argv[2], UserRole(sys.argv[3])
password = getpass.getpass("Password: ")
with SessionLocal() as db:
    db.add(User(email=email, full_name=name, role=role, password_hash=hash_password(password)))
    db.commit()
print(f"Created {role.value} {email}")