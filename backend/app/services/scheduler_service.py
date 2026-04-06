"""Scheduled background jobs for reminders – Google Sheets backed."""

import logging
from datetime import date, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.services.google_sheets_service import SheetsDB, _to_int
from app.services.meeting_service import _parse_date, _row_to_task, DotDict
from app.notifications.notification_service import NotificationService

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def check_deadline_reminders():
    """Send reminders for tasks due within 2 days."""
    logger.info("Running deadline reminder check")
    try:
        tomorrow = date.today() + timedelta(days=1)
        day_after = date.today() + timedelta(days=2)
        all_tasks = SheetsDB.get_all("Tasks")
        count = 0
        for t in all_tasks:
            dl = _parse_date(t.get("deadline"))
            status = t.get("status", "")
            if dl and tomorrow <= dl <= day_after and status != "Completed":
                task_obj = _row_to_task(t)
                await NotificationService.notify_deadline_reminder(None, task_obj)
                count += 1
        logger.info("Deadline reminders sent for %d tasks", count)
    except Exception as e:
        logger.error("Deadline reminder check failed: %s", e)


async def check_overdue_tasks():
    """Send alerts for overdue tasks."""
    logger.info("Running overdue task check")
    try:
        today = date.today()
        all_tasks = SheetsDB.get_all("Tasks")
        count = 0
        for t in all_tasks:
            dl = _parse_date(t.get("deadline"))
            status = t.get("status", "")
            if dl and dl < today and status != "Completed":
                task_obj = _row_to_task(t)
                await NotificationService.notify_overdue(None, task_obj)
                count += 1
        logger.info("Overdue alerts sent for %d tasks", count)
    except Exception as e:
        logger.error("Overdue check failed: %s", e)


async def check_frequent_absentees():
    """Warn about users who have been absent 3+ times."""
    logger.info("Running absentee check")
    try:
        from app.services.attendance_service import AttendanceService
        absentees = await AttendanceService.get_frequent_absentees(None)
        for record in absentees:
            if record.get("email"):
                await NotificationService.notify_absence_warning(
                    None,
                    email=record["email"],
                    user_name=record["user_name"],
                    count=record["absent_count"],
                )
        logger.info("Absence warnings sent for %d users", len(absentees))
    except Exception as e:
        logger.error("Absentee check failed: %s", e)


def start_scheduler():
    """Start the APScheduler with configured jobs."""
    scheduler.add_job(check_deadline_reminders, "cron", hour=9, minute=0, id="deadline_reminders")
    scheduler.add_job(check_overdue_tasks, "cron", hour=10, minute=0, id="overdue_tasks")
    scheduler.add_job(check_frequent_absentees, "cron", day_of_week="mon", hour=8, minute=0, id="absentee_check")
    scheduler.start()
    logger.info("Background scheduler started")


def shutdown_scheduler():
    """Shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Background scheduler stopped")
