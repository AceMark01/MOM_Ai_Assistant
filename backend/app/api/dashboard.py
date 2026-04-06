"""Dashboard analytics endpoint – Google Sheets backed."""

from fastapi import APIRouter

from app.schemas.schemas import AnalyticsResponse
from app.services.dashboard_service import DashboardService

router = APIRouter()


@router.get("/", response_model=AnalyticsResponse)
async def get_dashboard():
    return await DashboardService.get_dashboard(None)
