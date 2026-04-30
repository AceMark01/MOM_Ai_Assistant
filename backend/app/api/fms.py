"""FMS API endpoints – task management for admin and users."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.core.security import get_current_user, require_roles
from app.models.models import UserRole
from app.services.fms_service import FMSService

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────

class FMSTaskAssign(BaseModel):
    person_name: str
    job_description: str
    deadline_date: str
    person_email: str = ""
    high_priority: str = ""
    source: str = "MOM"


class FMSTaskComplete(BaseModel):
    task_sr_no: str
    new_date: str = ""
    reason: str = ""


class FMSTaskSeen(BaseModel):
    task_sr_no: str


# ── Admin Endpoints ──────────────────────────────────────────────────

@router.get("/tasks")
async def get_all_fms_tasks(current_user=Depends(get_current_user)):
    """Get all FMS tasks. Admin sees all, User sees only theirs."""
    if current_user.role in ("Admin", "CEO", "Manager", "HR"):
        tasks = FMSService.get_all_tasks()
    else:
        tasks = FMSService.get_tasks_for_user(current_user.name, current_user.email)
    return tasks


@router.post("/tasks/assign")
async def assign_fms_task(
    data: FMSTaskAssign,
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.CEO, UserRole.MANAGER))
):
    """Admin assigns a new task → writes to Delegation tab + sends email notification."""
    try:
        result = FMSService.assign_task(
            person_name=data.person_name,
            job_description=data.job_description,
            deadline_date=data.deadline_date,
            person_email=data.person_email,
            high_priority=data.high_priority,
            source=data.source,
        )
        
        # Send email notification to the assigned employee
        if data.person_email:
            try:
                from app.notifications.email_service import EmailService
                await EmailService.send_task_assignment(
                    to_email=data.person_email,
                    task_title=data.job_description,
                    meeting_title=f"Manual Assignment by {current_user.name}",
                    deadline=data.deadline_date or None,
                )
                
                # Log notification
                from app.services.google_sheets_service import SheetsDB
                from datetime import datetime
                SheetsDB.append_row("Notifications", {
                    "recipient_email": data.person_email,
                    "message": f"Task assigned: {data.job_description} (Assigned by: {current_user.name})",
                    "notification_type": "email",
                    "is_read": "False",
                    "sent_at": datetime.utcnow().isoformat(),
                })
            except Exception as email_err:
                import logging
                logging.getLogger(__name__).warning("Task assigned but email failed: %s", email_err)
        
        return {"status": "success", "task": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to assign task: {e}")


@router.post("/tasks/complete")
async def complete_fms_task(
    data: FMSTaskComplete,
    current_user=Depends(get_current_user)
):
    """User marks a task as Done → writes to Data tab."""
    success = FMSService.mark_task_done(
        task_sr_no=data.task_sr_no,
        user_name=current_user.name,
        new_date=data.new_date,
        reason=data.reason,
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to mark task as complete")
    return {"status": "success", "message": f"Task {data.task_sr_no} marked as Done"}


@router.post("/tasks/seen")
async def mark_fms_task_seen(
    data: FMSTaskSeen,
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.CEO, UserRole.MANAGER))
):
    """Admin acknowledges a completed task → writes to MGMT tab."""
    success = FMSService.mark_task_seen(task_sr_no=data.task_sr_no)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to mark task as seen")
    return {"status": "success", "message": f"Task {data.task_sr_no} marked as Seen"}


@router.get("/tasks/my")
async def get_my_fms_tasks(current_user=Depends(get_current_user)):
    """Get current user's tasks only."""
    return FMSService.get_tasks_for_user(current_user.name, current_user.email)


@router.get("/data-log")
async def get_completion_log(
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.CEO, UserRole.MANAGER))
):
    """Admin: Get the full Data tab completion log."""
    return FMSService.get_completion_log()


@router.get("/mgmt-log")
async def get_mgmt_log(
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.CEO, UserRole.MANAGER))
):
    """Admin: Get the full MGMT tab seen log."""
    return FMSService.get_mgmt_log()
