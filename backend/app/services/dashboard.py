from datetime import datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import clinic_now
from app.models import Appointment, AppointmentStatus, Invoice, InvoiceStatus
from app.schemas.common import PageParams
from app.schemas.dashboard import Dashboard, DashboardStats
from app.services import patients as patients_svc
from app.services.appointments import day_schedule

LIVE = (AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED)


def build_dashboard(db: Session, recent_limit: int = 5) -> Dashboard:
    now = clinic_now()
    today = now.date()

    schedule = day_schedule(db, today)
    on_duty = [d for d in schedule.therapists if d.therapist.is_active and not d.is_off]

    patients_today = db.scalar(
        select(func.count(func.distinct(Appointment.patient_id))).where(
            Appointment.date == today, Appointment.status.in_(LIVE)
        )
    ) or 0
    appt_counts = dict(
        db.execute(
            select(Appointment.status, func.count())
            .where(Appointment.date == today)
            .group_by(Appointment.status)
        ).all()
    )

    # "Today" in the clinic's timezone, converted to an absolute range for paid_at.
    day_start = datetime.combine(today, time.min, tzinfo=now.tzinfo)
    revenue_today = db.scalar(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(
            Invoice.status == InvoiceStatus.PAID,
            Invoice.paid_at >= day_start,
            Invoice.paid_at < day_start + timedelta(days=1),
        )
    )
    outstanding = db.scalar(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(Invoice.status == InvoiceStatus.DUE)
    )

    recent = patients_svc.list_patients(db, PageParams(page=1, page_size=recent_limit)).items

    return Dashboard(
        date=today,
        stats=DashboardStats(
            patients_today=patients_today,
            therapists_on_duty=len(on_duty),
            revenue_today=revenue_today,
            open_slots_remaining=sum(d.open_count for d in on_duty),
            appointments_today=sum(appt_counts.get(s, 0) for s in (*LIVE, AppointmentStatus.NO_SHOW)),
            appointments_completed=appt_counts.get(AppointmentStatus.COMPLETED, 0),
            outstanding_due=outstanding,
        ),
        capacity=on_duty,
        recent_patients=recent,
    )