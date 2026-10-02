from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.models import InvoiceStatus
from app.schemas.common import PageParams
from app.schemas.invoice import InvoiceCreate, InvoiceOut, InvoicePage, InvoiceUpdate
from app.services import invoices as svc

router = APIRouter(prefix="/invoices", tags=["billing"])


@router.get("", response_model=InvoicePage)
def list_invoices(
    db: DbSession,
    _: CurrentUser,
    page: Annotated[PageParams, Depends()],
    status: InvoiceStatus | None = None,
    patient_id: int | None = None,
    search: Annotated[str | None, Query(max_length=100, description="Patient, service or INV number")] = None,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
) -> InvoicePage:
    """All roles can read. `?patient_id=` gives a patient's billing history."""
    return svc.list_invoices(
        db, page, status=status, patient_id=patient_id, search=search,
        date_from=date_from, date_to=date_to,
    )


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: int, db: DbSession, _: CurrentUser) -> InvoiceOut:
    return InvoiceOut.model_validate(svc.get_or_404(db, invoice_id))


@router.post("", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(body: InvoiceCreate, db: DbSession, _: AdminUser) -> InvoiceOut:
    return InvoiceOut.model_validate(svc.create_invoice(db, body))


@router.patch("/{invoice_id}", response_model=InvoiceOut)
def update_invoice(invoice_id: int, body: InvoiceUpdate, db: DbSession, _: AdminUser) -> InvoiceOut:
    """Edit an invoice, e.g. `{"status": "paid", "payment_method": "cash"}`."""
    return InvoiceOut.model_validate(svc.update_invoice(db, invoice_id, body))


@router.delete("/{invoice_id}", response_model=InvoiceOut)
def void_invoice(invoice_id: int, db: DbSession, _: AdminUser) -> InvoiceOut:
    """Voids the invoice rather than erasing it. Void invoices don't count toward revenue."""
    return InvoiceOut.model_validate(svc.void_invoice(db, invoice_id))