"""Task CRUD endpoints – Google Sheets backed."""

from fastapi import APIRouter, HTTPException, Query

from app.models.models import TaskStatus
from app.schemas.schemas import TaskCreate, TaskUpdate, TaskResponse, TaskHistoryResponse
from app.services.task_service import TaskService

router = APIRouter()


@router.get("/", response_model=list[TaskResponse])
async def list_tasks(
    meeting_id: int | None = None,
    status: TaskStatus | None = None,
    skip: int = 0,
    limit: int = 100,
):
    return await TaskService.list_tasks(None, meeting_id=meeting_id, status=status, skip=skip, limit=limit)


@router.post("/{meeting_id}", response_model=TaskResponse, status_code=201)
async def create_task(meeting_id: int, data: TaskCreate):
    return await TaskService.create_task(None, meeting_id, data)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int):
    task = await TaskService.get_task(None, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, data: TaskUpdate):
    task = await TaskService.update_task(None, task_id, data, changed_by="system")
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}")
async def delete_task(task_id: int):
    deleted = await TaskService.delete_task(None, task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"detail": "Task deleted"}


@router.get("/{task_id}/history", response_model=list[TaskHistoryResponse])
async def get_task_history(task_id: int):
    return await TaskService.get_task_history(None, task_id)


@router.get("/overdue/list", response_model=list[TaskResponse])
async def get_overdue_tasks():
    return await TaskService.overdue_tasks(None)
