"""LangGraph MOM processing workflow.

Pipeline:
    Upload/Manual Input → Text Extraction → Clean Text → AI MOM Extraction
    → Data Validation → Database Save → Task Creation → Notifications
"""

import logging
import re
from typing import Optional, TypedDict

from langgraph.graph import StateGraph, END

from app.ai.extraction_service import get_ai_service
from app.schemas.schemas import ExtractedMOM
from app.services.file_service import FileService

logger = logging.getLogger(__name__)


# ── State ──────────────────────────────────────────────────────────────

class MOMWorkflowState(TypedDict, total=False):
    file_path: Optional[str]
    raw_text: Optional[str]
    extracted_text: Optional[str]
    cleaned_text: Optional[str]
    extracted_mom: Optional[ExtractedMOM]
    is_valid: bool
    validation_errors: list[str]
    meeting_id: Optional[int]
    task_ids: list[int]
    notifications_sent: int
    error: Optional[str]
    current_node: str


# ── Node functions ─────────────────────────────────────────────────────

def extract_text_node(state: MOMWorkflowState) -> dict:
    """Node 1: Extract raw text from uploaded file or use provided text."""
    logger.info("Node: ExtractText")
    try:
        if state.get("file_path"):
            text = FileService.extract_text(state["file_path"])
            return {"extracted_text": text, "current_node": "extract_text"}
        elif state.get("raw_text"):
            return {"extracted_text": state["raw_text"], "current_node": "extract_text"}
        else:
            return {"error": "No file path or raw text provided", "current_node": "extract_text"}
    except Exception as e:
        return {"error": f"Text extraction failed: {str(e)}", "current_node": "extract_text"}


def clean_text_node(state: MOMWorkflowState) -> dict:
    """Node 2: Clean and normalize extracted text."""
    logger.info("Node: CleanText")
    if state.get("error") or not state.get("extracted_text"):
        return {"current_node": "clean_text"}

    text = state["extracted_text"]
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove non-printable characters
    text = re.sub(r'[^\x20-\x7E\n\r\t]', '', text)
    # Normalize line breaks
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()

    return {"cleaned_text": text, "current_node": "clean_text"}


async def mom_extraction_node(state: MOMWorkflowState) -> dict:
    """Node 3: Send cleaned text to AI for structured extraction."""
    logger.info("Node: MOMExtraction")
    if state.get("error") or not state.get("cleaned_text"):
        return {"current_node": "mom_extraction"}

    try:
        service = get_ai_service()
        extracted = await service.extract_mom(state["cleaned_text"])
        return {"extracted_mom": extracted, "current_node": "mom_extraction"}
    except Exception as e:
        return {"error": f"AI extraction failed: {str(e)}", "current_node": "mom_extraction"}


def validate_data_node(state: MOMWorkflowState) -> dict:
    """Node 4: Validate extracted data completeness."""
    logger.info("Node: ValidateData")
    if state.get("error") or not state.get("extracted_mom"):
        return {"is_valid": False, "current_node": "validate_data"}

    errors = []
    mom = state["extracted_mom"]

    if not mom.meeting_title:
        errors.append("Meeting title not found")
    if not mom.attendees and not mom.absentees:
        errors.append("No participants found")

    is_valid = len(errors) == 0

    # Allow processing even with warnings – data will just be incomplete
    if errors:
        logger.warning("Validation warnings: %s", errors)

    return {
        "is_valid": True,  # Allow save even with missing fields
        "validation_errors": errors,
        "current_node": "validate_data",
    }


# ── Build the graph ───────────────────────────────────────────────────

def build_mom_workflow() -> StateGraph:
    """Build the LangGraph workflow for MOM processing.

    Note: SaveMeeting, CreateTasks, and Notification nodes are handled
    in the API layer after the graph runs, because they require a DB session.
    """
    workflow = StateGraph(MOMWorkflowState)

    workflow.add_node("extract_text", extract_text_node)
    workflow.add_node("clean_text", clean_text_node)
    workflow.add_node("mom_extraction", mom_extraction_node)
    workflow.add_node("validate_data", validate_data_node)

    workflow.set_entry_point("extract_text")
    workflow.add_edge("extract_text", "clean_text")
    workflow.add_edge("clean_text", "mom_extraction")
    workflow.add_edge("mom_extraction", "validate_data")
    workflow.add_edge("validate_data", END)

    return workflow


def get_mom_workflow():
    """Return a compiled MOM workflow graph."""
    wf = build_mom_workflow()
    return wf.compile()
