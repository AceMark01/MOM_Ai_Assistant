"""FastAPI application entry point – Google Sheets backed."""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.api.router import api_router
from app.services.scheduler_service import start_scheduler, shutdown_scheduler
from app.services.google_sheets_service import init_sheets

# Configure logging at a level that shows everything
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn") # Use uvicorn's logger settings
logging.getLogger("recording_api").setLevel(logging.INFO)
logging.getLogger("ai_service").setLevel(logging.INFO)

settings = get_settings()

# Ensure upload directory exists before mounting StaticFiles
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup - initialise Google Sheets tabs
    init_sheets()
    
    # Sync master admin credentials from .env
    _sync_admin_from_env()
    
    start_scheduler()
    yield
    # Shutdown
    shutdown_scheduler()


def _sync_admin_from_env():
    """Ensure a master admin account exists with credentials from .env.
    Always updates the FIRST existing Admin row. If no Admin exists, it creates one."""
    admin_email = settings.ADMIN_EMAIL
    admin_password = settings.ADMIN_PASSWORD
    
    if not admin_email or not admin_password:
        logger.info("ADMIN_EMAIL/ADMIN_PASSWORD not set in .env, skipping admin sync.")
        return
    
    try:
        from app.services.google_sheets_service import SheetsDB
        from app.core.security import hash_password
        
        # Check if ANY admin exists in the system (by role)
        existing_admins = SheetsDB.get_by_field("Users", "role", "Admin")
        
        if existing_admins:
            # Always update the VERY FIRST Admin row (usually ID 1) with the new .env credentials
            user_id = existing_admins[0].get("id")
            new_hash = hash_password(admin_password)
            SheetsDB.update_row("Users", int(user_id), {
                "name": "Admin",
                "email": admin_email,
                "hashed_password": new_hash,
                "is_active": "True",
            })
            logger.info("Master Admin synced: Overwrote ID %s with new email/password from .env", user_id)
        else:
            # Create new admin only if zero admins exist in the entire sheet
            from datetime import datetime
            SheetsDB.append_row("Users", {
                "name": "Admin",
                "email": admin_email,
                "hashed_password": hash_password(admin_password),
                "role": "Admin",
                "is_active": "True",
                "created_at": datetime.utcnow().isoformat(),
            })
            logger.info("Master Admin created: %s", admin_email)
    except Exception as e:
        logger.error("Failed to sync admin from .env: %s", e)


app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    description="AI-Powered Minutes of Meeting Management System – Google Sheets Database",
    lifespan=lifespan,
)

# Define allowed origins - prioritizing the FRONTEND_URL from .env
origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger = logging.getLogger("meeting_creation")
    try:
        body = await request.body()
        body_str = body.decode("utf-8")
    except Exception:
        body_str = "<binary or non-utf8 data>"
    
    logger.error("Validation error: %s", exc.errors())
    logger.error("Request body: %s", body_str)
    
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": body_str},
    )

app.add_exception_handler(RequestValidationError, validation_exception_handler)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
@app.head("/") # Explicitly allow HEAD requests for Render health checks
async def root():
    return {"message": f"Welcome to {settings.APP_NAME} API. Visit /docs for documentation."}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "database": "Google Sheets"}
