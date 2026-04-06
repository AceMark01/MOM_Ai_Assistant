"""Attendance tracking endpoints – Google Sheets backed."""

from fastapi import APIRouter

from app.schemas.schemas import AttendeeResponse
from app.services.attendance_service import AttendanceService

router = APIRouter()


@router.get("/meeting/{meeting_id}", response_model=list[AttendeeResponse])
async def get_meeting_attendance(meeting_id: int):
    return await AttendanceService.get_attendance_for_meeting(None, meeting_id)


@router.get("/absentees")
async def get_frequent_absentees(threshold: int = 3):
    return await AttendanceService.get_frequent_absentees(None, threshold)


@router.get("/user/{user_name}")
async def get_user_attendance(user_name: str):
    return await AttendanceService.get_user_attendance_count(None, user_name)
