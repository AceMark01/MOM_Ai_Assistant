"""WhatsApp notification service (Twilio-style integration)."""

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class WhatsAppService:
    """Twilio-compatible WhatsApp messaging service.

    This is a ready-to-use integration layer. To activate, set the
    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM
    environment variables.
    """

    BASE_URL = "https://api.twilio.com/2010-04-01/Accounts"

    @staticmethod
    async def send_whatsapp_message(to_number: str, message: str) -> bool:
        """Send a WhatsApp message via Twilio API.

        Args:
            to_number: Recipient phone number in E.164 format (e.g. +1234567890).
            message: Message body text.

        Returns:
            True if sent successfully, False otherwise.
        """
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.warning("Twilio credentials not configured – skipping WhatsApp message")
            return False

        url = f"{WhatsAppService.BASE_URL}/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        data = {
            "From": settings.TWILIO_WHATSAPP_FROM,
            "To": f"whatsapp:{to_number}",
            "Body": message,
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    url,
                    data=data,
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                )
                if resp.status_code in (200, 201):
                    logger.info("WhatsApp message sent to %s", to_number)
                    return True
                else:
                    logger.error("WhatsApp API error %s: %s", resp.status_code, resp.text)
                    return False
        except Exception as e:
            logger.error("WhatsApp send failure: %s", e)
            return False

    @staticmethod
    async def send_task_notification(to_number: str, task_title: str, meeting_title: str):
        msg = f"📋 New Task: {task_title}\nFrom Meeting: {meeting_title}\nPlease check the MOM Assistant for details."
        await WhatsAppService.send_whatsapp_message(to_number, msg)

    @staticmethod
    async def send_reminder(to_number: str, task_title: str, deadline: str):
        msg = f"⏰ Reminder: Task '{task_title}' is due on {deadline}. Please ensure timely completion."
        await WhatsAppService.send_whatsapp_message(to_number, msg)
