"""Invoices. "Deleting" an invoice voids it: financial records are never erased,
and void invoices are excluded from revenue and outstanding totals."""

import re
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import clinic_today
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.models import Appointment, Invoice, InvoiceStatus, Package, Patient
from app.schemas.common import PageParams
from app.schemas.invoice import InvoiceCreate, InvoiceOut, InvoicePage, InvoiceSummary, InvoiceUpdate

INVOICE_NUMBER = re.compile(r"^\s*(?:inv-?)?0*(\d+)\s*$", re.IGNORECASE)


def get_or_404(db: Session, invoice_id: int) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise NotFoundError("Invoice not found")
    return invoice


def _check_discount(amount: Decimal, discount: Decimal) -> None:
    if discount > amount:
        raise BusinessRuleError("Discount can't be more than the amount")


def _set_status(invoice: Invoice, status: str) -> None:
    new = InvoiceStatus(status)
    if new == invoice.status:
        return
    if new == InvoiceStatus.PAID and invoice.payment_method is None:
        raise BusinessRuleError("Set a payment method before marking the invoice paid")
    invoice.status = new
    invoice.paid_at = datetime.now(UTC) if new == InvoiceStatus.PAID else None


def create_invoice(db: Session, data: InvoiceCreate) -> Invoice:
    patient = db.get(Patient, data.patient_id)
    if patient is None:
        raise BusinessRuleError("Patient doesn't exist")

    service, amount = data.service, data.amount
    if data.package_id is not None:
        package = db.get(Package, data.package_id)
        if package is None:
            raise BusinessRuleError("Package doesn't exist")
        service = service or package.name
        amount = amount if amount is not None else package.price
    assert service is not None and amount is not None  # guaranteed by schema validator
    _check_discount(amount, data.discount)

    if data.appointment_id is not None:
        appt = db.get(Appointment, data.appointment_id)
        if appt is None or appt.patient_id != patient.id:
            raise BusinessRuleError("That appointment doesn't belong to this patient")
        already = db.scalar(
            select(Invoice.id).where(
                Invoice.appointment_id == appt.id, Invoice.status != InvoiceStatus.VOID
            )
        )
        if already:
            raise ConflictError(f"This appointment is already billed on INV-{already:05d}")

    invoice = Invoice(
        patient_id=patient.id,
        patient_name=patient.full_name,  # snapshot: survives patient deletion
        appointment_id=data.appointment_id,
        package_id=data.package_id,
        service=service,
        amount=amount,
        discount=data.discount,
        status=InvoiceStatus.DUE,
        payment_method=data.payment_method,
        issued_on=data.issued_on or clinic_today(),
        notes=data.notes,
    )
    _set_status(invoice, data.status)
    db.add(invoice)
    db.commit()
    db.refresh(invoice)  # load generated `total`
    return invoice


def update_invoice(db: Session, invoice_id: int, data: InvoiceUpdate) -> Invoice:
    invoice = get_or_404(db, invoice_id)
    if invoice.status == InvoiceStatus.VOID:
        raise ConflictError("Void invoices can't be edited")
    changes = data.model_dump(exclude_unset=True)
    for field in ("service", "amount", "discount", "status", "issued_on"):
        if field in changes and changes[field] is None:
            raise BusinessRuleError(f"{field} cannot be empty")

    amount = changes.get("amount", invoice.amount)
    discount = changes.get("discount", invoice.discount)
    _check_discount(amount, discount)

    for field in ("service", "amount", "discount", "payment_method", "issued_on", "notes"):
        if field in changes:
            setattr(invoice, field, changes[field])
    if invoice.status == InvoiceStatus.PAID and invoice.payment_method is None:
        raise BusinessRuleError("A paid invoice needs a payment method")
    if "status" in changes:
        _set_status(invoice, changes["status"])

    db.commit()
    db.refresh(invoice)
    return invoice


def void_invoice(db: Session, invoice_id: int) -> Invoice:
    invoice = get_or_404(db, invoice_id)
    if invoice.status != InvoiceStatus.VOID:
        invoice.status = InvoiceStatus.VOID
        invoice.paid_at = None
        db.commit()
        db.refresh(invoice)
    return invoice


def list_invoices(
    db: Session,
    page: PageParams,
    *,
    status: InvoiceStatus | None = None,
    patient_id: int | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> InvoicePage:
    base = []
    if patient_id is not None:
        base.append(Invoice.patient_id == patient_id)
    if search and search.strip():
        clauses = [Invoice.patient_name.ilike(f"%{search.strip()}%"), Invoice.service.ilike(f"%{search.strip()}%")]
        if m := INVOICE_NUMBER.match(search):
            clauses.append(Invoice.id == int(m.group(1)))
        base.append(or_(*clauses))
    if date_from:
        base.append(Invoice.issued_on >= date_from)
    if date_to:
        base.append(Invoice.issued_on <= date_to)
    filters = base + ([Invoice.status == status] if status else [])

    total = db.scalar(select(func.count()).select_from(Invoice).where(*filters)) or 0
    rows = db.scalars(
        select(Invoice).where(*filters).order_by(Invoice.issued_on.desc(), Invoice.id.desc())
        .offset(page.offset).limit(page.page_size)
    )

    def sum_where(s: InvoiceStatus):
        return func.coalesce(func.sum(case((Invoice.status == s, Invoice.total), else_=0)), 0)

    def count_where(s: InvoiceStatus):
        return func.count(case((Invoice.status == s, 1)))

    agg = db.execute(
        select(
            sum_where(InvoiceStatus.PAID), sum_where(InvoiceStatus.DUE),
            count_where(InvoiceStatus.PAID), count_where(InvoiceStatus.DUE), count_where(InvoiceStatus.VOID),
        ).select_from(Invoice).where(*base)
    ).one()

    return InvoicePage(
        items=[InvoiceOut.model_validate(i) for i in rows],
        total=total,
        page=page.page,
        page_size=page.page_size,
        summary=InvoiceSummary(
            paid_total=agg[0], due_total=agg[1], paid_count=agg[2], due_count=agg[3], void_count=agg[4]
        ),
    )