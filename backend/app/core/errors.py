"""Services raise these; one handler turns them into HTTP responses."""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError


class DomainError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail



class BusinessRuleError(DomainError):
    """Well-formed input that breaks a rule (e.g. end time before start time)."""
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT      

class NotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class ConflictError(DomainError):
    """Valid request that clashes with current data (e.g. slot already booked)."""
    status_code = status.HTTP_409_CONFLICT


class BusinessRuleError(DomainError):
    """Well-formed input that breaks a rule (e.g. end time before start time)."""
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY


CONSTRAINT_MESSAGES = {
    "ex_appointments_therapist_no_overlap": "The therapist already has an appointment at this time.",
    "ex_appointments_patient_no_overlap": "The patient already has an appointment at this time.",
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, exc: IntegrityError) -> JSONResponse:
        # Database constraint fired: return a clean 409, never raw SQL.
        name = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
        detail = CONSTRAINT_MESSAGES.get(name or "", "This change conflicts with existing data.")
        return JSONResponse({"detail": detail}, status_code=status.HTTP_409_CONFLICT)



  