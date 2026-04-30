"""FMS (Follow-up Management System) Service – reads/writes to the separate FMS Google Sheet.

This service connects to the FMS spreadsheet which has its own formula-driven workflow.
We ONLY append rows to Data, MGMT, FMS, and Delegation tabs – never modify formulas.
"""

import logging
from datetime import datetime
from typing import Any, Optional
from functools import wraps
import requests

import gspread
from google.oauth2.service_account import Credentials

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

def retry_on_failure(max_retries=3, delay=1, backoff=2):
    """Decorator to retry a function if it raises a connection-related exception."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            mtries, mdelay = max_retries, delay
            while mtries > 0:
                try:
                    return func(*args, **kwargs)
                except (requests.exceptions.ConnectionError, requests.exceptions.Timeout, 
                        gspread.exceptions.APIError, Exception) as e:
                    # Ignore non-transient API errors
                    if isinstance(e, gspread.exceptions.APIError) and e.response.status_code not in [500, 502, 503, 504, 429]:
                        raise e
                    
                    mtries -= 1
                    if mtries == 0:
                        logger.error(f"Final FMS failure after {max_retries} retries: {e}")
                        raise e
                    
                    wait = mdelay * (backoff ** (max_retries - mtries - 1))
                    logger.warning(f"FMS Google Sheets error ({e}), retrying in {wait}s...")
                    time_module.sleep(wait)
            return func(*args, **kwargs)
        return wrapper
    return decorator

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

import os
CREDENTIALS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "google_credentials.json",
)

# ── Singleton for FMS Sheet ──────────────────────────────────────────

_fms_client: gspread.Client | None = None
_fms_spreadsheet: gspread.Spreadsheet | None = None
_fms_worksheets: dict[str, gspread.Worksheet] = {}


def _get_fms_client() -> gspread.Client:
    global _fms_client
    if _fms_client is None:
        creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
        _fms_client = gspread.authorize(creds)
    return _fms_client


def _get_fms_spreadsheet() -> gspread.Spreadsheet:
    global _fms_spreadsheet
    if _fms_spreadsheet is None:
        fms_id = settings.FMS_SPREADSHEET_ID
        if not fms_id:
            raise ValueError("FMS_SPREADSHEET_ID not configured in .env")
        _fms_spreadsheet = _get_fms_client().open_by_key(fms_id)
        logger.info("Opened FMS spreadsheet: %s", _fms_spreadsheet.title)
    return _fms_spreadsheet


def _get_fms_worksheet(tab_name: str) -> gspread.Worksheet:
    global _fms_worksheets
    if tab_name in _fms_worksheets:
        return _fms_worksheets[tab_name]
    ss = _get_fms_spreadsheet()
    ws = ss.worksheet(tab_name)
    _fms_worksheets[tab_name] = ws
    return ws


# ── Cache for FMS reads ──────────────────────────────────────────────

import time as time_module
_FMS_CACHE_TTL = 15
_fms_cache: dict[str, tuple[list, float]] = {}


@retry_on_failure(max_retries=3)
def _get_fms_values(tab_name: str) -> list[list[str]]:
    now = time_module.time()
    if tab_name in _fms_cache:
        data, ts = _fms_cache[tab_name]
        if now - ts < _FMS_CACHE_TTL:
            return data
    ws = _get_fms_worksheet(tab_name)
    all_vals = ws.get_all_values()
    _fms_cache[tab_name] = (all_vals, now)
    return all_vals


def _invalidate_fms_cache(tab_name: str):
    _fms_cache.pop(tab_name, None)


# ── FMS Tab Structure ────────────────────────────────────────────────
# FMS tab has metadata rows 1-5, then headers at row 6, data from row 7+
# Columns: A=TimeStamp, B=Sr No., C=Name Of The Person, D=Job Assigned,
#          E=Date, F=Total Changed Planned, G=High, H=Reason Why Not Complete,
#          I=Planned, J=Actual, K=Status, L=Time Delay,
#          M=Planned1, N=Actual1,# ── Sheet Config (Adjusted for "Long Term Delegation FMS" structure) ──
FMS_HEADER_ROW = 6      # Headers are in Row 6
FMS_DATA_START = 7      # First data row is Satyendra in Row 7 (TN-01)
FMS_TAB_NAME = "FMS"    # Main tracking tab
DELEGATION_TAB = "Delegation"
DATA_TAB = "Data"
MGMT_TAB = "MGMT"


class FMSService:
    """Service for reading/writing to the FMS Google Sheet."""

    # ── Read All Tasks from FMS Tab ──────────────────────────────────

    @staticmethod
    def get_all_tasks() -> list[dict]:
        """Read all tasks from the FMS tab with MGMT cross-referencing for real-time status."""
        try:
            all_vals = _get_fms_values("FMS")
            if len(all_vals) < FMS_HEADER_ROW:
                return []

            # Find headers (row 6, index 5)
            headers_raw = all_vals[FMS_HEADER_ROW - 1] if len(all_vals) >= FMS_HEADER_ROW else []
            
            # Normalize header names
            header_map = {}
            for i, h in enumerate(headers_raw):
                clean = h.strip().lower().replace(" ", "_").replace("\n", "_")
                header_map[i] = clean

            # Optimization: Fetch MGMT and DATA values to provide immediate status updates
            # even if the sheet formulas haven't recalculated yet.
            mgmt_vals = _get_fms_values("MGMT")
            seen_tasks = {str(row[0]).strip(): str(row[2]).strip() for row in mgmt_vals[1:] if len(row) >= 3} # sr_no -> status

            data_vals = _get_fms_values("Data")
            done_tasks = {str(row[0]).strip() for row in data_vals[1:] if len(row) >= 1} # set of sr_no's that are done

            tasks = []
            for row_idx, row in enumerate(all_vals[FMS_DATA_START - 1:], start=FMS_DATA_START):
                if not any(str(cell).strip() for cell in row):
                    continue
                
                # Initialize task and map headers carefully
                task = {"_row_index": row_idx}
                
                # Critical field: Sr No
                task["sr_no"] = str(_get_val(row, headers_raw, ["Sr No", "sr_no", "Sr. No", "Serial"])).strip()
                
                # Fallback: If Sr No is missing, use Row Index as temporary ID BEFORE status check
                if not task["sr_no"] and (_get_val(row, headers_raw, ["Name Of The Person", "name_of_the_person"]) or _get_val(row, headers_raw, ["Job Assigned", "job_assigned"])):
                    task["sr_no"] = f"ROW-{row_idx}"
                
                # Get status fields
                raw_status = _get_val(row, headers_raw, ["Status", "status"])
                raw_status1 = _get_val(row, headers_raw, ["Status1", "status1"])
                actual_date = _get_val(row, headers_raw, ["Actual", "actual"])
                
                # MGMT & DATA Cross-reference (Immediate action reflection)
                sr_id = task["sr_no"]
                is_seen = (raw_status1.lower() == "seen") or (seen_tasks.get(sr_id) == "Seen")
                is_done = (raw_status.lower() == "done") or (actual_date and str(actual_date).strip()) or (sr_id in done_tasks)

                # Determine final status for UI (Using User's preferred labels)
                if is_seen:
                    task["status"] = "Completed"
                elif is_done:
                    task["status"] = "Awaiting Review"
                else:
                    task["status"] = "Pending"  # Always 'Pending' instead of 'Not Done'

                # Data mapping for UI
                task["name"] = _get_val(row, headers_raw, ["Name Of The Person", "name_of_the_person"])
                task["job"] = _get_val(row, headers_raw, ["Job Assigned", "job_assigned"])
                task["date"] = _get_val(row, headers_raw, ["Date", "date"])
                task["actual"] = actual_date
                task["high"] = _get_val(row, headers_raw, ["High", "high"])
                task["reason"] = _get_val(row, headers_raw, ["Reason Why Not Complete", "reason_why_not_complete"])
                task["time_delay"] = _get_val(row, headers_raw, ["Time Delay", "time_delay"])
                
                if task["sr_no"]:
                    tasks.append(task)

            return tasks[::-1]  # Newest tasks first
        except Exception as e:
            logger.error("Failed to read FMS tasks: %s", e)
            return []

    # ── Get Tasks for a Specific User ────────────────────────────────

    @staticmethod
    def get_tasks_for_user(user_name: str, user_email: str) -> list[dict]:
        """Get tasks filtered by user name or email."""
        all_tasks = FMSService.get_all_tasks()
        user_tasks = []
        name_lower = (user_name or "").strip().lower()
        email_lower = (user_email or "").strip().lower()

        for t in all_tasks:
            task_name = (t.get("name") or "").strip().lower()
            task_email = (t.get("gmail") or "").strip().lower()
            
            # Match by email if exists, otherwise fallback to name
            if email_lower and task_email and task_email == email_lower:
                user_tasks.append(t)
            elif name_lower and task_name and name_lower in task_name:
                user_tasks.append(t)

        return user_tasks

    # ── Generate Next TN Number ──────────────────────────────────────

    @staticmethod
    def next_tn_number() -> str:
        """Generate next TN-XX serial number by scanning FMS, Delegation and Data tabs."""
        try:
            # 1. Get all tasks from FMS (Main source)
            all_tasks = FMSService.get_all_tasks()
            
            # 2. Also check Delegation (Source of truth for assignments)
            del_vals = _get_fms_values("Delegation")
            # Usually Col B (index 1) has Sr No.
            del_ids = [str(row[1]).strip() for row in del_vals[1:] if len(row) > 1]
            
            # Extract numbers from all IDs (TN-01 -> 1)
            numbers = []
            
            # Check FMS tasks
            for t in all_tasks:
                sr = t.get("sr_no", "")
                if "TN-" in sr:
                    try: numbers.append(int(sr.replace("TN-", "")))
                    except: pass
            
            # Check Delegation IDs
            for sr in del_ids:
                if "TN-" in sr:
                    try: numbers.append(int(sr.replace("TN-", "")))
                    except: pass

            next_num = max(numbers) + 1 if numbers else 1
            return f"TN-{next_num:02d}"
        except Exception as e:
            logger.error("Error generating next TN number: %s", e)
            return "TN-01"

    # ── Assign New Task (Write to Delegation ONLY) ──────────────────

    @staticmethod
    @retry_on_failure(max_retries=3)
    def assign_task(person_name: str, job_description: str, deadline_date: str,
                    person_email: str = "", high_priority: str = "",
                    source: str = "MOM") -> dict:
        """
        Assign a new task:
        ONLY Write to Delegation tab. 
        The FMS tab has array formulas that pull from Delegation automatically.
        """
        now = datetime.now()
        timestamp = now.strftime("%m/%d/%Y %H:%M:%S")
        tn = FMSService.next_tn_number()

        # Write to Delegation tab (Source tab)
        # Sequence: Timestamp, Sr No, Person, Job, Date
        try:
            del_ws = _get_fms_worksheet("Delegation")
            # We add to the first empty row below headers
            del_row = [timestamp, tn, person_name, job_description, deadline_date]
            del_ws.append_row(del_row, value_input_option="USER_ENTERED")
            _invalidate_fms_cache("Delegation")
            _invalidate_fms_cache("FMS") # FMS pulls from here
            logger.info("FMS task assigned via Delegation: %s -> %s", tn, person_name)
        except Exception as e:
            logger.error("Failed to write to Delegation tab: %s", e)
            raise

        return {
            "sr_no": tn,
            "name": person_name,
            "job": job_description,
            "date": deadline_date,
            "gmail": person_email,
            "status": "Not Done",
            "source": source,
        }

    # ── User Marks Task as Done (Write to Data tab) ──────────────────

    @staticmethod
    @retry_on_failure(max_retries=3)
    def mark_task_done(task_sr_no: str, user_name: str, new_date: str = "",
                       reason: str = "") -> bool:
        """
        User marks a task as complete.
        Writes a new row to the 'Data' tab.
        FMS formulas will auto-update Status to 'Done'.
        """
        try:
            data_ws = _get_fms_worksheet("Data")
            now = datetime.now()
            timestamp = now.strftime("%m/%d/%Y %H:%M:%S")
            
            row = [task_sr_no, timestamp, "Done", new_date, reason, user_name]
            data_ws.append_row(row, value_input_option="USER_ENTERED")
            _invalidate_fms_cache("Data")
            _invalidate_fms_cache("FMS")  # FMS will recalculate
            logger.info("Task %s marked Done by %s", task_sr_no, user_name)
            return True
        except Exception as e:
            logger.error("Failed to mark task done: %s", e)
            return False

    # ── Admin Marks Task as Seen (Write to MGMT tab) ─────────────────

    @staticmethod
    @retry_on_failure(max_retries=3)
    def mark_task_seen(task_sr_no: str) -> bool:
        """
        Admin acknowledges a completed task.
        Writes a new row to the 'MGMT' tab.
        FMS formulas will auto-update Status1 to 'Seen'.
        """
        try:
            mgmt_ws = _get_fms_worksheet("MGMT")
            now = datetime.now()
            timestamp = now.strftime("%m/%d/%Y %H:%M:%S")
            
            row = [task_sr_no, timestamp, "Seen"]
            mgmt_ws.append_row(row, value_input_option="USER_ENTERED")
            _invalidate_fms_cache("MGMT")
            _invalidate_fms_cache("FMS")  # FMS will recalculate
            logger.info("Task %s marked Seen by Admin", task_sr_no)
            return True
        except Exception as e:
            logger.error("Failed to mark task seen: %s", e)
            return False

    # ── Get Completion Log (Data tab) ────────────────────────────────

    @staticmethod
    def get_completion_log() -> list[dict]:
        """Read all entries from Data tab."""
        try:
            all_vals = _get_fms_values("Data")
            if len(all_vals) <= 1:
                return []
            headers = all_vals[0]
            results = []
            for row in all_vals[1:]:
                if not any(str(c).strip() for c in row):
                    continue
                padded = row + [""] * (len(headers) - len(row))
                results.append(dict(zip(headers, padded)))
            return results
        except Exception as e:
            logger.error("Failed to read Data tab: %s", e)
            return []

    # ── Get MGMT Log ─────────────────────────────────────────────────

    @staticmethod
    def get_mgmt_log() -> list[dict]:
        """Read all entries from MGMT tab."""
        try:
            all_vals = _get_fms_values("MGMT")
            if len(all_vals) <= 1:
                return []
            headers = all_vals[0]
            results = []
            for row in all_vals[1:]:
                if not any(str(c).strip() for c in row):
                    continue
                padded = row + [""] * (len(headers) - len(row))
                results.append(dict(zip(headers, padded)))
            return results
        except Exception as e:
            logger.error("Failed to read MGMT tab: %s", e)
            return []


# ── Helper Functions ─────────────────────────────────────────────────

import re as _re

def _normalize_header(s: str) -> str:
    """Normalize a header string by stripping whitespace, punctuation, lowering, and replacing spaces/newlines with underscores."""
    cleaned = _re.sub(r'[.,;:!?]', '', s)  # Strip punctuation like dots, commas
    return cleaned.strip().lower().replace(" ", "_").replace("\n", "_")


def _get_val(row: list, headers: list, aliases: list[str]) -> str:
    """Get value from row by trying multiple header name aliases."""
    for alias in aliases:
        norm_alias = _normalize_header(alias)
        for i, h in enumerate(headers):
            if _normalize_header(h) == norm_alias:
                if i < len(row):
                    return (row[i] or "").strip()
    return ""


def _find_col_idx(headers: list, aliases: list[str]) -> int | None:
    """Find column index from header aliases."""
    for alias in aliases:
        norm_alias = _normalize_header(alias)
        for i, h in enumerate(headers):
            if _normalize_header(h) == norm_alias:
                return i
    return None


def _set_col(row: list, headers: list, aliases: list[str], value: str):
    """Set value in the correct column position."""
    idx = _find_col_idx(headers, aliases)
    if idx is not None and idx < len(row):
        row[idx] = value
