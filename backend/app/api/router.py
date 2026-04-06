"""Central API router – aggregates all sub-routers."""

from fastapi import APIRouter

from app.api.users import router as users_router
from app.api.meetings import router as meetings_router
from app.api.tasks import router as tasks_router
from app.api.attendance import router as attendance_router
from app.api.notifications import router as notifications_router
from app.api.dashboard import router as dashboard_router
from app.api.upload import router as upload_router
from app.api.br_meetings import router as br_meetings_router
from app.api.recording import router as recording_router
from app.api.branding import router as branding_router

api_router = APIRouter()

api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(meetings_router, prefix="/meetings", tags=["Meetings"])
api_router.include_router(tasks_router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(attendance_router, prefix="/attendance", tags=["Attendance"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(upload_router, prefix="/upload", tags=["Upload & AI"])
api_router.include_router(br_meetings_router, prefix="/br", tags=["Board Resolutions"])
api_router.include_router(recording_router, prefix="/recording", tags=["Recording & Local AI"])
api_router.include_router(branding_router, prefix="/branding", tags=["Branding"])
