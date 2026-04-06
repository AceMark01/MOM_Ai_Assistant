"""Notification endpoints – Google Sheets backed."""

from fastapi import APIRouter, HTTPException

from app.schemas.schemas import NotificationResponse
from app.notifications.notification_service import NotificationService

router = APIRouter()


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(skip: int = 0, limit: int = 50):
    return await NotificationService.list_notifications(None, skip, limit)


@router.put("/{notification_id}/read")
async def mark_notification_read(notification_id: int):
    success = await NotificationService.mark_read(None, notification_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"detail": "Notification marked as read"}
