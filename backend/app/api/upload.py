"""File upload and AI extraction endpoint – Google Sheets backed."""

import os
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File

from app.config import get_settings
from app.schemas.schemas import MeetingResponse, ExtractedMOM
from app.services.file_service import FileService
from app.services.meeting_service import MeetingService
from app.services.google_sheets_service import upload_to_drive
from app.notifications.notification_service import NotificationService
from app.workflows.mom_workflow import get_mom_workflow

settings = get_settings()
router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".txt"}


@router.post("/mom", response_model=MeetingResponse)
async def upload_and_process_mom(file: UploadFile = File(...)):
    """Upload a MOM file (PDF/TXT), run through AI extraction pipeline, and save to Google Sheets."""

    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Allowed: {ALLOWED_EXTENSIONS}")

    # Validate file size
    content = await file.read()
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.MAX_FILE_SIZE_MB}MB limit")

    # Save file
    file_path = await FileService.save_upload(content, file.filename)

    # Run LangGraph workflow
    try:
        workflow = get_mom_workflow()
        result = await workflow.ainvoke({"file_path": file_path})

        if result.get("error"):
            raise HTTPException(status_code=422, detail=result["error"])

        extracted_mom: ExtractedMOM = result.get("extracted_mom")
        if not extracted_mom:
            raise HTTPException(status_code=422, detail="AI extraction returned no data")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing pipeline failed: {str(e)}")

    # Save to database (Google Sheets)
    try:
        meeting = await MeetingService.create_from_extraction(
            None, extracted_mom, created_by=None, file_path=file_path
        )
    except Exception as e:
        logger.error("Database save failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save data to database")

    # Upload PROFESSIONALLY FORMATTED document to Google Drive
    try:
        from app.api.meetings import generate_meeting_pdf
        
        # Generate the formatted bytes based on the database record
        pdf_bytes, pdf_name = generate_meeting_pdf(meeting)
        
        drive_folder_name = "Meetings"
        
        drive_result = upload_to_drive(
            file_bytes=pdf_bytes,
            filename=pdf_name,
            mimetype="application/pdf",
            subfolder_name=drive_folder_name
        )
        # Update the meeting with the real drive link
        new_url = drive_result.get("webViewLink", "")
        if new_url:
            await MeetingService.update_meeting_pdf_link(
                meeting.id,
                pdf_link=new_url,
                drive_file_id=drive_result.get("id", "")
            )
            meeting.file_path = new_url  # Update instance to return in API response
    except Exception as e:
        logger.error("Upload to Drive failed: %s", e)
        # We don't fail the request since the database record is already complete

    # Notify task assignees
    if hasattr(meeting, 'tasks') and meeting.tasks:
        for task in meeting.tasks:
            await NotificationService.notify_task_assigned(None, task, meeting.title)

    return meeting


@router.post("/extract-preview", response_model=ExtractedMOM)
async def preview_extraction(file: UploadFile = File(...)):
    """Upload a file and preview AI extraction without saving."""

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    content = await file.read()
    file_path = await FileService.save_upload(content, file.filename)

    try:
        workflow = get_mom_workflow()
        result = await workflow.ainvoke({"file_path": file_path})

        if result.get("error"):
            raise HTTPException(status_code=422, detail=result["error"])

        extracted = result.get("extracted_mom")
        if not extracted:
            raise HTTPException(status_code=422, detail="Extraction returned no data")

        return extracted
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    finally:
        # Clean up temp file for preview
        try:
            os.remove(file_path)
        except OSError:
            pass
