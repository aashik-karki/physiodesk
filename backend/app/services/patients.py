from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import BusinessRuleError, NotFoundError
from app.models import Package, Patient, PatientStatus, Therapist
from app.schemas.common import Page, PageParams
from app.schemas.patient import PatientCreate, PatientOut, PatientUpdate

REQUIRED_FIELDS = {"full_name", "phone", "age", "gender", "condition", "status"}


def get_or_404(db: Session, patient_id: int) -> Patient:
    patient = db.scalar(
        select(Patient)
        .options(joinedload(Patient.therapist), joinedload(Patient.package))
        .where(Patient.id == patient_id)
    )
    if patient is None:
        raise NotFoundError("Patient not found")
    return patient


def _check_refs(db: Session, therapist_id: int | None, package_id: int | None) -> None:
    if therapist_id is not None:
        t = db.get(Therapist, therapist_id)
        if t is None or not t.is_active:
            raise BusinessRuleError("Assigned therapist doesn't exist or is no longer active")
    if package_id is not None:
        p = db.get(Package, package_id)
        if p is None or not p.is_active:
            raise BusinessRuleError("Package doesn't exist or is no longer offered")


def list_patients(
    db: Session,
    page: PageParams,
    *,
    search: str | None = None,
    therapist_id: int | None = None,
    status: PatientStatus | None = None,
) -> Page[PatientOut]:
    filters = []
    if search and search.strip():
        term = search.strip()
        like = f"%{term}%"
        digits = "".join(ch for ch in term if ch.isdigit())
        clauses = [Patient.full_name.ilike(like)]
        if digits:
            # Match phone ignoring spaces, dashes and a leading +.
            clauses.append(
                func.regexp_replace(Patient.phone, r"[^0-9]", "", "g").contains(digits)
            )
        filters.append(or_(*clauses))
    if therapist_id is not None:
        filters.append(Patient.therapist_id == therapist_id)
    if status is not None:
        filters.append(Patient.status == status)

    total = db.scalar(select(func.count()).select_from(Patient).where(*filters)) or 0
    rows = db.scalars(
        select(Patient)
        .options(joinedload(Patient.therapist), joinedload(Patient.package))
        .where(*filters)
        .order_by(Patient.created_at.desc(), Patient.id.desc())
        .offset(page.offset)
        .limit(page.page_size)
    )
    return Page[PatientOut](
        items=[PatientOut.model_validate(p) for p in rows],
        total=total,
        page=page.page,
        page_size=page.page_size,
    )


def create_patient(db: Session, data: PatientCreate) -> Patient:
    _check_refs(db, data.therapist_id, data.package_id)
    patient = Patient(**data.model_dump())
    db.add(patient)
    db.commit()
    return get_or_404(db, patient.id)


def update_patient(db: Session, patient_id: int, data: PatientUpdate) -> Patient:
    patient = get_or_404(db, patient_id)
    changes = data.model_dump(exclude_unset=True)
    for field in REQUIRED_FIELDS & changes.keys():
        if changes[field] is None:
            raise BusinessRuleError(f"{field} cannot be empty")
    # Only validate references that are actually being changed, so editing a patient
    # whose therapist was later removed doesn't fail on an unrelated field.
    _check_refs(
        db,
        changes.get("therapist_id") if "therapist_id" in changes else None,
        changes.get("package_id") if "package_id" in changes else None,
    )
    for field, value in changes.items():
        setattr(patient, field, value)
    db.commit()
    db.expire(patient)
    return get_or_404(db, patient.id)


def delete_patient(db: Session, patient_id: int) -> None:
    """Hard delete. Appointments go with the patient; invoices are kept with a
    name snapshot (see Invoice model)."""
    patient = get_or_404(db, patient_id)
    db.delete(patient)
    db.commit()


def list_packages(db: Session) -> list[Package]:
    return list(
        db.scalars(select(Package).where(Package.is_active.is_(True)).order_by(Package.price))
    )