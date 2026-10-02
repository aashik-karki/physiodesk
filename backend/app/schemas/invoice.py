from datetime import date as Date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.models.enums import InvoiceStatus, PaymentMethod
from app.schemas.common import Page

Money = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]
# Void is reached only through DELETE, never set directly.
EditableStatus = Literal["paid", "due"]


class InvoiceCreate(BaseModel):
    patient_id: int
    package_id: int | None = Field(default=None, description="If set, service and amount default from the package")
    appointment_id: int | None = Field(default=None, description="Optional session this bill is for")
    service: str | None = Field(default=None, min_length=1, max_length=160)
    amount: Money | None = None
    discount: Money = Decimal("0")
    status: EditableStatus = "due"
    payment_method: PaymentMethod | None = None
    issued_on: Date | None = Field(default=None, description="Defaults to today")
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _paid_needs_method(self):
        if self.status == "paid" and self.payment_method is None:
            raise ValueError("payment_method is required when status is paid")
        if self.package_id is None and (self.service is None or self.amount is None):
            raise ValueError("Give either a package_id, or both service and amount")
        return self


class InvoiceUpdate(BaseModel):
    service: str | None = Field(default=None, min_length=1, max_length=160)
    amount: Money | None = None
    discount: Money | None = None
    status: EditableStatus | None = None
    payment_method: PaymentMethod | None = None
    issued_on: Date | None = None
    notes: str | None = Field(default=None, max_length=2000)


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int | None = Field(description="null if the patient record was deleted")
    patient_name: str
    appointment_id: int | None
    package_id: int | None
    service: str
    amount: Decimal
    discount: Decimal
    total: Decimal
    status: InvoiceStatus
    payment_method: PaymentMethod | None
    issued_on: Date
    paid_at: datetime | None
    notes: str | None
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def number(self) -> str:
        return f"INV-{self.id:05d}"


class InvoiceSummary(BaseModel):
    """Totals across all invoices matching the filters (ignoring the status filter)."""

    paid_total: Decimal
    due_total: Decimal
    paid_count: int
    due_count: int
    void_count: int


class InvoicePage(Page[InvoiceOut]):
    summary: InvoiceSummary