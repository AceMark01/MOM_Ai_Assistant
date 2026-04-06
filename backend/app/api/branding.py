from fastapi import APIRouter
from app.config import get_settings

router = APIRouter()
settings = get_settings()

@router.get("/")
async def get_branding_config():
    """Returns the branding configuration for the frontend."""
    return {
        "client_name": settings.CLIENT_NAME,
        "client_cs_email": settings.CLIENT_CS_EMAIL,
        "show_botivate_branding": settings.SHOW_BOTIVATE_BRANDING,
        "botivate_signature": settings.BOTIVATE_SIGNATURE
    }
