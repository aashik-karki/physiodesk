from datetime import date, datetime
from zoneinfo import ZoneInfo
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    cookie_secure: bool = False  # True in production (HTTPS only)
    clinic_timezone: str = "Asia/Kathmandu"
    cors_origins: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()



def clinic_now() -> datetime:
    return datetime.now(ZoneInfo(get_settings().clinic_timezone))


def clinic_today() -> date:
    """'Today' as the clinic in Kathmandu sees it, not the server's UTC clock."""
    return clinic_now().date()    