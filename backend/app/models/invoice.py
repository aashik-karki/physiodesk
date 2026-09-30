from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Computed, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import InvoiceStatus, PaymentMethod, pg_enum


class Invoice(TimestampMixin, Base):
    __tablename__ = "invoices"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="amount_non_negative"),
        CheckConstraint("discount >= 0 AND discount <= amount", name="discount_range"),
        CheckConstraint("(status = 'paid') = (paid_at IS NOT NULL)", name="paid_at_matches_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int | None] = mapped_column(
        ForeignKey("patients.id", ondelete="SET NULL"), index=True
    )
    patient_name: Mapped[str] = mapped_column(String(120))
    appointment_id: Mapped[int | None] = mapped_column(ForeignKey("appointments.id", ondelete="SET NULL"))
    package_id: Mapped[int | None] = mapped_column(ForeignKey("packages.id", ondelete="SET NULL"))
    service: Mapped[str] = mapped_column(String(160))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"), server_default="0")
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), Computed("amount - discount", persisted=True))
    status: Mapped[InvoiceStatus] = mapped_column(
        pg_enum(InvoiceStatus, "invoice_status"), default=InvoiceStatus.DUE, index=True
    )
    payment_method: Mapped[PaymentMethod | None] = mapped_column(pg_enum(PaymentMethod, "payment_method"))
    issued_on: Mapped[date] = mapped_column(Date, index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    notes: Mapped[str | None] = mapped_column(Text)