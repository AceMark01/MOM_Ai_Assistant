"""Application configuration using pydantic-settings."""

from pathlib import Path
from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    APP_NAME: str = "MOM AI Assistant"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DEFAULT_CS_EMAIL: str = "prabhatkumarsictc7070@gmail.com"

    # Branding & White-Labeling
    CLIENT_NAME: str = "Botivate Services LLP"
    CLIENT_ADDRESS: str = "Shriram Business Park, Block-I , Office No- 224 , Vidhan Sabha Rd, Raipur, Chhattisgarh 493111"
    CLIENT_CS_EMAIL: str = "prabhatkumarsictc7070@gmail.com"
    SHOW_BOTIVATE_BRANDING: bool = True
    BOTIVATE_SIGNATURE: str = "Powered by Botivate Services LLP"
    
    # Google Cloud Configuration
    SPREADSHEET_ID: str = "1VEejcQEil9gGYChPNI00R96XWJBlbHd3j9hib6PrOp0"
    DRIVE_FOLDER_ID: str = "0AAgyfuup7OPSUk9PVA"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./mom_assistant.db"

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4"

    # AssemblyAI
    ASSEMBLY_AI_API_KEY: str = ""

    # SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = ""

    # Twilio / WhatsApp
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    # Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 10

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "allow"
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
