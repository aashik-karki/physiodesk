from enum import Enum

from sqlalchemy import Enum as SAEnum


class UserRole(str, Enum):
    ADMIN = "admin"
    STAFF = "staff"


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class PatientStatus(str, Enum):
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"


class AppointmentStatus(str, Enum):
    BOOKED = "booked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class SessionType(str, Enum):
    ASSESSMENT = "assessment"
    TREATMENT = "treatment"
    FOLLOW_UP = "follow_up"


class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    DIGITAL_WALLET = "digital_wallet"
    PACKAGE = "package"


class InvoiceStatus(str, Enum):
    PAID = "paid"
    DUE = "due"
    VOID = "void"


def pg_enum(enum_cls: type[Enum], name: str) -> SAEnum:
    """Store the lowercase value ('on_hold'), not the Python name ('ON_HOLD')."""
    return SAEnum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])