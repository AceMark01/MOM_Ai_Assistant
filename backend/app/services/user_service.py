"""User service – CRUD operations via Google Sheets."""

from datetime import datetime
import logging

from app.services.google_sheets_service import SheetsDB, _to_int
from app.services.meeting_service import DotDict, _parse_iso_datetime
from app.core.security import hash_password

logger = logging.getLogger(__name__)


class UserService:

    @staticmethod
    async def create_user(db, data) -> DotDict:
        now = datetime.utcnow().isoformat()
        row = SheetsDB.append_row("Users", {
            "name": data.name,
            "email": data.email,
            "hashed_password": hash_password(data.password),
            "role": data.role.value if hasattr(data.role, 'value') else str(data.role),
            "phone": data.phone,
            "is_active": "True",
            "created_at": now,
        })
        return _row_to_user(row)

    @staticmethod
    async def get_user_by_id(db, user_id: int) -> DotDict | None:
        u = SheetsDB.get_by_id("Users", user_id)
        if not u:
            return None
        return _row_to_user(u)

    @staticmethod
    async def get_user_by_email(db, email: str) -> DotDict | None:
        users = SheetsDB.get_by_field("Users", "email", email)
        if not users:
            return None
        return _row_to_user(users[0])

    @staticmethod
    async def list_users(db, skip: int = 0, limit: int = 100):
        all_users = SheetsDB.get_all("Users")
        sliced = all_users[skip:skip + limit]
        return [_row_to_user(u) for u in sliced]

    @staticmethod
    async def update_user(db, user_id: int, data) -> DotDict | None:
        user = SheetsDB.get_by_id("Users", user_id)
        if not user:
            return None
        update_data = data.model_dump(exclude_unset=True) if hasattr(data, 'model_dump') else data.dict(exclude_unset=True)
        if "role" in update_data and hasattr(update_data["role"], "value"):
            update_data["role"] = update_data["role"].value
        SheetsDB.update_row("Users", user_id, update_data)
        updated = SheetsDB.get_by_id("Users", user_id)
        return _row_to_user(updated) if updated else None

    @staticmethod
    async def delete_user(db, user_id: int) -> bool:
        user = SheetsDB.get_by_id("Users", user_id)
        if not user:
            return False
        SheetsDB.delete_row("Users", user_id)
        return True

    @staticmethod
    async def count_users(db) -> int:
        return SheetsDB.count("Users")


def _row_to_user(u: dict) -> DotDict:
    from app.services.google_sheets_service import _to_bool
    return DotDict({
        "id": _to_int(str(u.get("id", ""))) or 0,
        "name": u.get("name", ""),
        "email": u.get("email", ""),
        "hashed_password": u.get("hashed_password", ""),
        "role": u.get("role", "Employee"),
        "phone": u.get("phone") or None,
        "is_active": _to_bool(str(u.get("is_active", "True"))),
        "created_at": _parse_iso_datetime(u.get("created_at")),
    })
