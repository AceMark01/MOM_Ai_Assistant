"""Enums for the MOM AI Assistant – Google Sheets does not use ORM models."""

import enum


# ── Enums ──────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    CEO = "CEO"
    MANAGER = "Manager"
    HR = "HR"
    EMPLOYEE = "Employee"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "Present"
    ABSENT = "Absent"
    EXCUSED = "Excused"


class TaskStatus(str, enum.Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"


class NotificationType(str, enum.Enum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    IN_APP = "in_app"
