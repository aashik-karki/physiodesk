from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.models import PatientStatus
from app.schemas.common import Page, PageParams
from app.schemas.patient import PackageOut, PatientCreate, PatientOut, PatientUpdate
from app.services import patients as svc

router = APIRouter(prefix="/patients", tags=["patients"])
packages_router = APIRouter(prefix="/packages", tags=["packages"])


@router.get("", response_model=Page[PatientOut])
def list_patients(
    db: DbSession,
    _: CurrentUser,
    page: Annotated[PageParams, Depends()],
    search: Annotated[str | None, Query(max_length=100, description="Name or phone")] = None,
    therapist_id: int | None = None,
    status: PatientStatus | None = None,
) -> Page[PatientOut]:
    return svc.list_patients(db, page, search=search, therapist_id=therapist_id, status=status)


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: DbSession, _: CurrentUser) -> PatientOut:
    return PatientOut.model_validate(svc.get_or_404(db, patient_id))


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(body: PatientCreate, db: DbSession, _: CurrentUser) -> PatientOut:
    return PatientOut.model_validate(svc.create_patient(db, body))


@router.patch("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int, body: PatientUpdate, db: DbSession, _: CurrentUser
) -> PatientOut:
    return PatientOut.model_validate(svc.update_patient(db, patient_id, body))


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: int, db: DbSession, _: CurrentUser) -> Response:
    svc.delete_patient(db, patient_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@packages_router.get("", response_model=list[PackageOut])
def list_packages(db: DbSession, _: CurrentUser) -> list[PackageOut]:
    return [PackageOut.model_validate(p) for p in svc.list_packages(db)]