from fastapi import APIRouter

from app.api.routes import appointments, auth, patients, therapists

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(therapists.router)
api_router.include_router(patients.router)
api_router.include_router(patients.packages_router)
api_router.include_router(appointments.router)
api_router.include_router(appointments.schedule_router)