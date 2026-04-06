"""Attendance service – tracking via Google Sheets."""

import logging

from app.services.google_sheets_service import SheetsDB, _to_int
from app.services.meeting_service import DotDict, _row_to_attendee

logger = logging.getLogger(__name__)


class AttendanceService:

    ABSENT_WARNING_THRESHOLD = 3

    @staticmethod
    async def get_attendance_for_meeting(db, meeting_id: int):
        rows = SheetsDB.get_by_field("Attendees", "meeting_id", meeting_id)
        return [_row_to_attendee(a) for a in rows]

    @staticmethod
    async def get_frequent_absentees(db, threshold: int | None = None):
        t = threshold or AttendanceService.ABSENT_WARNING_THRESHOLD
        all_attendees = SheetsDB.get_all("Attendees")
        absent_counts: dict[str, dict] = {}
        for a in all_attendees:
            if a.get("attendance_status", "").strip() == "Absent":
                name = a.get("user_name", "")
                if name not in absent_counts:
                    absent_counts[name] = {"user_name": name, "email": a.get("email"), "absent_count": 0}
                absent_counts[name]["absent_count"] += 1

        return [v for v in absent_counts.values() if v["absent_count"] >= t]

    @staticmethod
    async def get_user_attendance_count(db, user_name: str) -> dict:
        all_attendees = SheetsDB.get_all("Attendees")
        present = sum(1 for a in all_attendees if a.get("user_name") == user_name and a.get("attendance_status", "").strip() == "Present")
        absent = sum(1 for a in all_attendees if a.get("user_name") == user_name and a.get("attendance_status", "").strip() == "Absent")
        return {
            "user_name": user_name,
            "present": present,
            "absent": absent,
        }
