# 🏢 White-Labeling & Multi-Company Implementation Guide

If you want to implement the Botivate MOM AI Assistant for another company, you need to update several hardcoded values and branding elements in the codebase. This guide outlines every change required to make the system fully compatible with a new company.

---

## 1. Backend Configuration (The Core)

The backend has several points where "Botivate" is set as the default.

### `backend/app/config.py`
Change the default CS email to the new company's Secretary/Admin email.
*   **Search for:** `DEFAULT_CS_EMAIL`
*   **Action:** Change the value to the new company's default.

### `backend/app/schemas/schemas.py`
The default value for the "Organization" field in meeting requests needs update.
*   **Search for:** `organization: Optional[str] = "Botivate Services LLP"`
*   **Action:** Replace with the new company name.

### `backend/app/services/meeting_service.py` & `br_meeting_service.py`
Fallback logic when organization is missing in data.
*   **Search for:** `"Botivate Services LLP"`
*   **Action:** Update the dictionary fallback values to the new company.

---

## 2. Branding in Documents (PDFs)

All generated documents (MOM, Transcripts, Audit Trails) have "Botivate" in the header/footer.

### `backend/app/utils/pdf_generator.py`
This file handles all PDF drawing logic.
*   **Header Branding:** Search for `canvas.drawRightString` and `canvas.drawString` calls containing "BOTIVATE". Update these to the new company name.
*   **Footer Branding:** Update the page footer text (e.g., `Botivate Services LLP | Executive Briefing`).
*   **Visuals (Logo):** If the new company has a logo, replace the drawing logic (or image file path) in the `draw_header` function.

---

## 3. Email Templates

The notification system sends stylized HTML emails.

### `backend/app/notifications/email_service.py`
The HTML templates have hardcoded headers and signatures.
*   **Search for:** `<h2>Botivate Services LLP</h2>` inside the HTML strings.
*   **Action:** Replace with the new company name. You may also want to change the primary colors in the inline CSS (e.g., `#3b82f6` for brand blue).

---

## 4. Frontend UI & Autofill

The frontend has "Botivate" pre-filled in scheduling forms.

### `frontend/src/pages/ScheduleMeetingPage.tsx`
Change the initial state of the organization field.
*   **Line to change:** `organization: 'Botivate Services LLP',`

### `frontend/src/pages/CreateMOMPage.tsx`
Change the initial state here as well.
*   **Line to change:** `organization: 'Botivate Services LLP',`

### `frontend/src/pages/BRDetailPage.tsx`
The browser prompt for sending to CS has a hardcoded default email.
*   **Search for:** `window.prompt(..., 'prabhatkumarsictc7070@gmail.com')`
*   **Action:** Update the second argument to the new company's CS email.

### `frontend/src/pages/DashboardPage.tsx`
The dashboard title usually contains "Botivate". Check and update the `<h2>` or `<h1>` tags.

---

## 5. Storage (Google Sheet & Drive)

Every company MUST have its own dedicated storage to keep data separate.

1.  **Google Sheet:** Create a NEW Google Sheet from the master template.
2.  **Google Drive:** Create a NEW folder in Drive for recordings and PDFs.
3.  **Environment Variables:** Update the following in Render/Vercel:
    *   `GOOGLE_SHEETS_ID`
    *   `GOOGLE_DRIVE_FOLDER_ID`
    *   `DEFAULT_CS_EMAIL`

---

## 💡 Best Practice: Centralizing Settings

Instead of changing code in 10 places, it is recommended to move these to the `backend/.env` and `frontend/.env` files:

1.  **Backend:** Add `COMPANY_NAME` to `.env` and use `get_settings().COMPANY_NAME` everywhere.
2.  **Frontend:** Add `VITE_COMPANY_NAME` to `.env` and use `import.meta.env.VITE_COMPANY_NAME` in React components.

This way, for every new company, you ONLY need to change the Environment Variables, not the code!

---
**Botivate Services LLP (c) 2026**
