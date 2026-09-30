from datetime import date, time

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Text, Time, text
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import AppointmentStatus, PaymentMethod, SessionType, pg_enum
from app.models.patient import Patient
from app.models.therapist import Therapist

TIME_RANGE = text("tsrange(date + start_time, date + end_time)")
NOT_CANCELLED = text("status <> 'cancelled'")


class Appointment(TimestampMixin, Base):
    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="time_order"),
        ExcludeConstraint(
            ("therapist_id", "="), (TIME_RANGE, "&&"),
            name="ex_appointments_therapist_no_overlap", using="gist", where=NOT_CANCELLED,
        ),
        ExcludeConstraint(
            ("patient_id", "="), (TIME_RANGE, "&&"),
            name="ex_appointments_patient_no_overlap", using="gist", where=NOT_CANCELLED,
        ),
        Index("ix_appointments_date_therapist", "date", "therapist_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    therapist_id: Mapped[int] = mapped_column(ForeignKey("therapists.id", ondelete="RESTRICT"))
    date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    status: Mapped[AppointmentStatus] = mapped_column(
        pg_enum(AppointmentStatus, "appointment_status"), default=AppointmentStatus.BOOKED
    )
    session_type: Mapped[SessionType] = mapped_column(
        pg_enum(SessionType, "session_type"), default=SessionType.TREATMENT
    )
    payment_method: Mapped[PaymentMethod] = mapped_column(pg_enum(PaymentMethod, "payment_method"))
    notes: Mapped[str | None] = mapped_column(Text)

    patient: Mapped[Patient] = relationship()
    therapist: Mapped[Therapist] = relationship()