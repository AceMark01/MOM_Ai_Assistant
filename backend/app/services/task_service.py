"""Task service – CRUD and status tracking via Google Sheets."""

from datetime import date, datetime
import logging

from app.services.google_sheets_service import SheetsDB, _to_int
from app.services.meeting_service import _parse_date, _row_to_task, DotDict, _parse_iso_datetime

logger = logging.getLogger(__name__)


class TaskService:

    @staticmethod
    async def create_task(db, meeting_id: int, data) -> DotDict:
        now = datetime.utcnow().isoformat()
        row = SheetsDB.append_row("Tasks", {
            "meeting_id": meeting_id,
            "title": data.title,
            "description": data.description,
            "responsible_person": data.responsible_person,
            "responsible_email": data.responsible_email,
            "deadline": data.deadline,
            "status": data.status if hasattr(data, 'status') else "Pending",
            "created_at": now,
        })
        task_id = _to_int(str(row.get("id", "")))

        # Initial history entry
        SheetsDB.append_row("TaskHistory", {
            "task_id": task_id,
            "previous_status": "",
            "new_status": data.status if hasattr(data, 'status') else "Pending",
            "changed_at": now,
            "changed_by": "system",
        })

        return _row_to_task(row)

    @staticmethod
    async def get_task(db, task_id: int) -> DotDict | None:
        t = SheetsDB.get_by_id("Tasks", task_id)
        if not t:
            return None
        task = _row_to_task(t)
        # Load history
        history = SheetsDB.get_by_field("TaskHistory", "task_id", task_id)
        task.history = [DotDict({
            "id": _to_int(str(h.get("id", ""))) or 0,
            "task_id": task_id,
            "previous_status": h.get("previous_status") or None,
            "new_status": h.get("new_status", ""),
            "changed_at": _parse_iso_datetime(h.get("changed_at")),
            "changed_by": h.get("changed_by") or None,
        }) for h in history]
        # Load meeting reference
        if task.meeting_id:
            m = SheetsDB.get_by_id("Meetings", task.meeting_id)
            if m:
                task.meeting = DotDict({"id": task.meeting_id, "title": m.get("title", "")})
        return task

    @staticmethod
    async def list_tasks(db, meeting_id: int | None = None, status=None, skip: int = 0, limit: int = 100):
        all_tasks = SheetsDB.get_all("Tasks")

        if meeting_id:
            all_tasks = [t for t in all_tasks if _to_int(str(t.get("meeting_id", ""))) == meeting_id]
        if status:
            status_val = status.value if hasattr(status, 'value') else str(status)
            all_tasks = [t for t in all_tasks if t.get("status", "") == status_val]

        # Sort by created_at desc
        all_tasks.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        sliced = all_tasks[skip:skip + limit]

        results = []
        for t in sliced:
            task = _row_to_task(t)
            # Add meeting reference
            mid = _to_int(str(t.get("meeting_id", "")))
            if mid:
                m = SheetsDB.get_by_id("Meetings", mid)
                if m:
                    task.meeting = DotDict({"id": mid, "title": m.get("title", "")})
            results.append(task)
        return results

    @staticmethod
    async def update_task(db, task_id: int, data, changed_by: str = "system") -> DotDict | None:
        task = SheetsDB.get_by_id("Tasks", task_id)
        if not task:
            return None

        old_status = task.get("status", "")
        update_data = data.model_dump(exclude_unset=True) if hasattr(data, 'model_dump') else data.dict(exclude_unset=True)

        # Serialise date fields
        if "deadline" in update_data and update_data["deadline"]:
            update_data["deadline"] = str(update_data["deadline"])

        SheetsDB.update_row("Tasks", task_id, update_data)

        # Log status change
        if "status" in update_data and str(update_data["status"]) != str(old_status):
            new_status_val = update_data["status"]
            if hasattr(new_status_val, 'value'):
                new_status_val = new_status_val.value
            SheetsDB.append_row("TaskHistory", {
                "task_id": task_id,
                "previous_status": old_status,
                "new_status": new_status_val,
                "changed_at": datetime.utcnow().isoformat(),
                "changed_by": changed_by,
            })

        updated = SheetsDB.get_by_id("Tasks", task_id)
        return _row_to_task(updated) if updated else None

    @staticmethod
    async def delete_task(db, task_id: int) -> bool:
        task = SheetsDB.get_by_id("Tasks", task_id)
        if not task:
            return False
        SheetsDB.delete_by_field("TaskHistory", "task_id", task_id)
        SheetsDB.delete_row("Tasks", task_id)
        return True

    @staticmethod
    async def count_by_status(db) -> dict[str, int]:
        all_tasks = SheetsDB.get_all("Tasks")
        counts = {"Pending": 0, "In Progress": 0, "Completed": 0}
        for t in all_tasks:
            s = t.get("status", "Pending")
            if s in counts:
                counts[s] += 1
            else:
                counts[s] = 1
        return counts

    @staticmethod
    async def overdue_tasks(db):
        today = date.today()
        all_tasks = SheetsDB.get_all("Tasks")
        overdue = []
        for t in all_tasks:
            deadline = _parse_date(t.get("deadline"))
            status = t.get("status", "")
            if deadline and deadline < today and status != "Completed":
                task = _row_to_task(t)
                mid = _to_int(str(t.get("meeting_id", "")))
                if mid:
                    m = SheetsDB.get_by_id("Meetings", mid)
                    if m:
                        task.meeting = DotDict({"id": mid, "title": m.get("title", "")})
                    else:
                        task.meeting = None
                overdue.append(task)
        overdue.sort(key=lambda x: x.deadline or date.max)
        return overdue

    @staticmethod
    async def get_task_history(db, task_id: int):
        history = SheetsDB.get_by_field("TaskHistory", "task_id", task_id)
        results = []
        for h in history:
            results.append(DotDict({
                "id": _to_int(str(h.get("id", ""))) or 0,
                "task_id": task_id,
                "previous_status": h.get("previous_status") or None,
                "new_status": h.get("new_status", ""),
                "changed_at": _parse_iso_datetime(h.get("changed_at")),
                "changed_by": h.get("changed_by") or None,
            }))
        results.sort(key=lambda x: x.changed_at, reverse=True)
        return results
