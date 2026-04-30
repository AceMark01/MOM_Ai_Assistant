"""Cleanup script: Remove ROW-XX garbage entries from MGMT and Data tabs.
These were written by our buggy code when Sr No. header matching was failing.
This does NOT touch any formulas - only removes rows with invalid ROW-XX task IDs."""
import os
from google.oauth2.service_account import Credentials
import gspread

CREDS_FILE = "google_credentials.json"
FMS_ID = None

with open(".env") as f:
    for line in f:
        if line.strip().startswith("FMS_SPREADSHEET_ID"):
            FMS_ID = line.split("=", 1)[1].strip().strip('"').strip("'")

creds = Credentials.from_service_account_file(CREDS_FILE, scopes=["https://www.googleapis.com/auth/spreadsheets"])
client = gspread.authorize(creds)
ss = client.open_by_key(FMS_ID)

# === Clean MGMT Tab ===
print("=== Cleaning MGMT Tab ===")
mgmt = ss.worksheet("MGMT")
mgmt_vals = mgmt.get_all_values()
print(f"  Total rows (incl. header): {len(mgmt_vals)}")

# Find rows with ROW- IDs (delete from bottom to top to preserve indices)
rows_to_delete_mgmt = []
for i, row in enumerate(mgmt_vals):
    if i == 0:  # skip header
        continue
    task_id = str(row[0]).strip() if row else ""
    if task_id.startswith("ROW-"):
        rows_to_delete_mgmt.append(i + 1)  # 1-indexed for sheets
        print(f"  Will delete row {i+1}: {row[:3]}")

# Delete from bottom to top
for row_num in sorted(rows_to_delete_mgmt, reverse=True):
    mgmt.delete_rows(row_num)
    print(f"  Deleted MGMT row {row_num}")

print(f"  Cleaned {len(rows_to_delete_mgmt)} ROW- entries from MGMT")

# === Clean Data Tab ===
print("\n=== Cleaning Data Tab ===")
data_ws = ss.worksheet("Data")
data_vals = data_ws.get_all_values()
print(f"  Total rows (incl. header): {len(data_vals)}")

rows_to_delete_data = []
for i, row in enumerate(data_vals):
    if i == 0:  # skip header
        continue
    task_id = str(row[0]).strip() if row else ""
    if task_id.startswith("ROW-"):
        rows_to_delete_data.append(i + 1)
        print(f"  Will delete row {i+1}: {row[:4]}")

for row_num in sorted(rows_to_delete_data, reverse=True):
    data_ws.delete_rows(row_num)
    print(f"  Deleted Data row {row_num}")

print(f"  Cleaned {len(rows_to_delete_data)} ROW- entries from Data")

print(f"\n✅ Cleanup complete! Total removed: {len(rows_to_delete_mgmt) + len(rows_to_delete_data)} garbage rows")
