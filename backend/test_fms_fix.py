"""Quick test to verify FMS header matching fix - standalone."""
import os, re
from google.oauth2.service_account import Credentials
import gspread

CREDS_FILE = "google_credentials.json"
FMS_ID = None

# Read .env for FMS_SPREADSHEET_ID
with open(".env") as f:
    for line in f:
        if line.strip().startswith("FMS_SPREADSHEET_ID"):
            FMS_ID = line.split("=", 1)[1].strip().strip('"').strip("'")

creds = Credentials.from_service_account_file(CREDS_FILE, scopes=["https://www.googleapis.com/auth/spreadsheets"])
client = gspread.authorize(creds)
ss = client.open_by_key(FMS_ID)
ws = ss.worksheet("FMS")
all_vals = ws.get_all_values()

headers_raw = all_vals[5]  # Row 6 (0-indexed: 5)

# _normalize_header (our fixed version)
def _normalize_header(s):
    cleaned = re.sub(r'[.,;:!?]', '', s)
    return cleaned.strip().lower().replace(" ", "_").replace("\n", "_")

def _get_val(row, headers, aliases):
    for alias in aliases:
        norm_alias = _normalize_header(alias)
        for i, h in enumerate(headers):
            if _normalize_header(h) == norm_alias:
                if i < len(row):
                    return (row[i] or "").strip()
    return ""

print("=== Header Normalization Test ===")
for i, h in enumerate(headers_raw):
    print(f"  Col {i}: [{h}] -> [{_normalize_header(h)}]")

print("\n=== Task Sr No. Extraction Test (last 8 rows) ===")
print(f"{'Sr No':12s} | {'Name':25s} | {'Status':12s}")
print("-" * 55)

row_count = 0
tn_count = 0
for row_idx, row in enumerate(all_vals[6:], start=7):
    if not any(str(cell).strip() for cell in row):
        continue
    sr_no = _get_val(row, headers_raw, ["Sr No", "sr_no", "Sr. No", "Serial"])
    name = _get_val(row, headers_raw, ["Name Of The Person", "name_of_the_person"])
    status = _get_val(row, headers_raw, ["Status", "status"])
    
    if sr_no and "TN" in sr_no:
        tn_count += 1
    row_count += 1
    
    if row_count > len(all_vals) - 14:  # last 8
        print(f"{sr_no:12s} | {name:25s} | {status:12s}")

print(f"\nTotal data rows: {row_count}")
print(f"Tasks with TN IDs: {tn_count}")
print(f"Tasks with empty Sr No: {row_count - tn_count}")
