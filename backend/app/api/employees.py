"""Employee master lookup endpoints."""

from fastapi import APIRouter, HTTPException

from app.services.google_sheets_service import get_worksheet

router = APIRouter()


def _normalise_header(value: str) -> str:
    return "".join(ch for ch in str(value).lower() if ch.isalnum())


def _get_field(row: list[str], header_index: dict[str, int], aliases: list[str]) -> str:
    for alias in aliases:
        idx = header_index.get(alias)
        if idx is not None and idx < len(row):
            return (row[idx] or "").strip()
    return ""


@router.get("/master")
async def list_employee_master():
    """Return employee master records for attendee dropdown selection."""
    try:
        ws = get_worksheet("Employee Master")
        values = ws.get_all_values()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read Employee Master sheet: {exc}")

    if not values:
        return []

    headers = values[0]
    header_index = {_normalise_header(h): i for i, h in enumerate(headers)}

    records = []
    for row in values[1:]:
        emp_id = _get_field(row, header_index, ["empid", "employeeid", "empcode"])
        department = _get_field(row, header_index, ["department", "dept"])
        user_name = _get_field(row, header_index, ["doersname", "employeename", "name"])
        email = _get_field(row, header_index, ["email", "mail"])
        number = _get_field(row, header_index, ["number", "phone", "mobilenumber", "contactnumber"])
        name_with_department = _get_field(row, header_index, ["namewithdepartment"])

        if not user_name:
            continue

        if not name_with_department:
            name_with_department = f"{user_name} - {department}".strip(" -")

        records.append(
            {
                "emp_id": emp_id,
                "user_name": user_name,
                "department": department,
                "designation": department,
                "email": email,
                "number": number,
                "name_with_department": name_with_department,
            }
        )

    records.sort(key=lambda x: (x.get("user_name") or "").lower())
    return records
