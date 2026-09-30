from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import Gender, PatientStatus, pg_enum
from app.models.therapist import Package, Therapist


class Patient(TimestampMixin, Base):
    __tablename__ = "patients"
    __table_args__ = (CheckConstraint("age BETWEEN 0 AND 130", name="age_range"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), index=True)
    phone: Mapped[str] = mapped_column(String(32), index=True)
    age: Mapped[int]
    gender: Mapped[Gender] = mapped_column(pg_enum(Gender, "gender"))
    address: Mapped[str | None] = mapped_column(String(255))
    condition: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PatientStatus] = mapped_column(
        pg_enum(PatientStatus, "patient_status"), default=PatientStatus.ACTIVE, index=True
    )
    therapist_id: Mapped[int | None] = mapped_column(
        ForeignKey("therapists.id", ondelete="SET NULL"), index=True
    )
    package_id: Mapped[int | None] = mapped_column(ForeignKey("packages.id", ondelete="SET NULL"))

    therapist: Mapped[Therapist | None] = relationship()
    package: Mapped[Package | None] = relationship()