"""AI extraction service using LangChain + OpenAI structured output."""

import json
import logging
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

from app.config import get_settings
from app.schemas.schemas import ExtractedMOM

logger = logging.getLogger(__name__)
settings = get_settings()

MOM_EXTRACTION_PROMPT = """You are an expert AI assistant that extracts structured information from Minutes of Meeting (MOM) documents.

Analyze the following meeting text and extract ALL available information into the specified JSON structure.

MEETING TEXT:
---
{text}
---

Extract the following information and return it as a valid JSON object:

{{
    "organization_name": "Name of the organization",
    "meeting_title": "Title of the meeting",
    "meeting_type": "Type of meeting (e.g., Board Meeting, Team Standup, Project Review)",
    "date": "Meeting date in YYYY-MM-DD format",
    "meeting_mode": "Online or Offline",
    "time": "Meeting time in HH:MM format (24-hour)",
    "venue": "Location, conference room, or link (Google Meet etc)",
    "hosted_by": "Person who hosted or called the meeting",
    "attendees": [
        {{"name": "Name", "email": "Email", "designation": "Designation/Role", "whatsapp_number": "Phone/WhatsApp", "remarks": "Any remark or note mentioned for this person"}}
    ],
    "absentees": [
        {{"name": "Name", "email": "Email", "designation": "Designation/Role", "whatsapp_number": "Phone/WhatsApp", "remarks": "Any remark or note mentioned for this person"}}
    ],
    "agenda": [
        {{"topic": "Agenda topic title", "description": "Brief description"}}
    ],
    "discussion_summary": "Point-wise bulleted summary of key discussions and outcomes (5-8 points)",
    "action_items": [
        {{
            "task": "Description of the task",
            "responsible_person": "Person responsible",
            "deadline": "Deadline in YYYY-MM-DD format if mentioned",
            "status": "Pending"
        }}
    ],
    "next_meeting_date": "Next meeting date in YYYY-MM-DD format if mentioned",
    "next_meeting_time": "Next meeting time in HH:MM format if mentioned"
}}

IMPORTANT:
- Extract ALL attendees and absentees mentioned.
- Extract ALL action items / tasks with responsible persons and deadlines.
- If a field is not found in the text, use null.
- Dates should be in YYYY-MM-DD format.
- Always return valid JSON.
- Do not include any text before or after the JSON object.
"""


class AIExtractionService:

    def __init__(self):
        self.llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            temperature=0,
            api_key=settings.OPENAI_API_KEY,
        )
        self.prompt = ChatPromptTemplate.from_template(MOM_EXTRACTION_PROMPT)

    async def extract_mom(self, text: str) -> ExtractedMOM:
        """Extract structured MOM data from raw text using OpenAI."""
        chain = self.prompt | self.llm
        response = await chain.ainvoke({"text": text})
        content = response.content.strip()

        # Strip markdown code fences if present
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        data = json.loads(content)
        return ExtractedMOM(**data)


# Module-level singleton
_service: Optional[AIExtractionService] = None


def get_ai_service() -> AIExtractionService:
    global _service
    if _service is None:
        _service = AIExtractionService()
    return _service
