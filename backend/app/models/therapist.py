from datetime import date, time
from decimal import Decimal

from sqlalchemy import (ARRAY, Boolean, CheckConstraint, Date, ForeignKey, Numeric,
                        SmallInteger, String, Time, UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Therapist(TimestampMixin, Base):
    __tablename__ = "therapists"
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="working_hours_order"),
        CheckConstraint("slot_minutes BETWEEN 10 AND 240", name="slot_minutes_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    specialty: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    working_days: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger))  # 1=Mon ... 7=Sun
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    slot_minutes: Mapped[int] = mapped_column(SmallInteger, default=45)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", index=True)


class TherapistOverride(TimestampMixin, Base):
    """One-off change for a single date: a day off, or custom hours."""

    __tablename__ = "therapist_overrides"
    __table_args__ = (
        UniqueConstraint("therapist_id", "date", name="uq_therapist_overrides_therapist_date"),
        CheckConstraint(
            "(is_off AND start_time IS NULL AND end_time IS NULL) OR "
            "(NOT is_off AND start_time IS NOT NULL AND end_time > start_time)",
            name="off_or_valid_hours",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    therapist_id: Mapped[int] = mapped_column(ForeignKey("therapists.id", ondelete="CASCADE"))
    date: Mapped[date] = mapped_column(Date)
    is_off: Mapped[bool] = mapped_column(Boolean, default=False)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    reason: Mapped[str | None] = mapped_column(String(200))


class Package(TimestampMixin, Base):
    __tablename__ = "packages"
    __table_args__ = (CheckConstraint("price >= 0", name="price_non_negative"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    session_count: Mapped[int] = mapped_column(SmallInteger, default=1)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")