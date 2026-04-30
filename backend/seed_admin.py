"""Seed initial Admin user into Users sheet if none exists."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.google_sheets_service import SheetsDB
from app.core.security import hash_password
from datetime import datetime


def seed_admin():
    """Create the initial Admin user if no admin exists."""
    users = SheetsDB.get_all("Users")
    
    # Check if any admin exists
    for u in users:
        if u.get("role", "").strip() == "Admin":
            print(f"Admin already exists: {u.get('name')} ({u.get('email')})")
            return
    
    # Generate next ID
    max_id = 0
    for u in users:
        try:
            uid = int(u.get("id", 0))
            max_id = max(max_id, uid)
        except (ValueError, TypeError):
            pass
    
    admin_data = {
        "id": str(max_id + 1),
        "name": "Admin",
        "email": "admin@acemark.in",
        "hashed_password": hash_password("Admin@2025"),
        "role": "Admin",
        "phone": "",
        "is_active": "True",
        "created_at": datetime.utcnow().isoformat(),
    }
    
    SheetsDB.append_row("Users", admin_data)
    print(f"✅ Admin user created!")
    print(f"   Email: admin@acemark.in")
    print(f"   Password: Admin@2025")
    print(f"   Role: Admin")


if __name__ == "__main__":
    seed_admin()
