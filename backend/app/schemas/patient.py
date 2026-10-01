from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Gender, PatientStatus
from app.schemas.common import Name, Phone, ShortText
from app.schemas.therapist import TherapistRef


class PackageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    session_count: int
    price: Decimal


class PackageRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class PatientCreate(BaseModel):
    full_name: Name
    phone: Phone
    age: int = Field(ge=0, le=130)
    gender: Gender
    address: str | None = Field(default=None, max_length=255)
    condition: ShortText
    notes: str | None = Field(default=None, max_length=2000)
    status: PatientStatus = PatientStatus.ACTIVE
    therapist_id: int | None = None
    package_id: int | None = None


class PatientUpdate(BaseModel):
    """Partial update. Send `therapist_id: null` / `package_id: null` to unassign."""

    full_name: Name | None = None
    phone: Phone | None = None
    age: int | None = Field(default=None, ge=0, le=130)
    gender: Gender | None = None
    address: str | None = Field(default=None, max_length=255)
    condition: ShortText | None = None
    notes: str | None = Field(default=None, max_length=2000)
    status: PatientStatus | None = None
    therapist_id: int | None = None
    package_id: int | None = None


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone: str
    age: int
    gender: Gender
    address: str | None
    condition: str
    notes: str | None
    status: PatientStatus
    therapist: TherapistRef | None
    package: PackageRef | None
    created_at: datetime
    updated_at: datetime