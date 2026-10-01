from fastapi import APIRouter

from app.api.routes import auth, therapists

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(therapists.router)