from datetime import date as Date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.appointment import TherapistDay
from app.schemas.patient import PatientOut


class DashboardStats(BaseModel):
    patients_today: int = Field(description="Distinct patients with a booked or completed appointment today")
    therapists_on_duty: int
    revenue_today: Decimal = Field(description="Sum of invoices marked paid today (clinic time)")
    open_slots_remaining: int = Field(description="Unbooked slots still ahead today, all therapists")
    appointments_today: int
    appointments_completed: int
    outstanding_due: Decimal = Field(description="Total of all unpaid (due) invoices")


class Dashboard(BaseModel):
    date: Date
    stats: DashboardStats
    capacity: list[TherapistDay] = Field(description="Slot grid for each therapist on duty today")
    recent_patients: list[PatientOut]