"""File handling service – upload, text extraction."""

import os
import uuid
from pathlib import Path

from PyPDF2 import PdfReader

from app.config import get_settings

settings = get_settings()


class FileService:

    @staticmethod
    async def save_upload(file_content: bytes, filename: str) -> str:
        """Save uploaded file and return relative path."""
        ext = Path(filename).suffix.lower()
        safe_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(settings.UPLOAD_DIR, safe_name)
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(file_content)
        return file_path

    @staticmethod
    def extract_text(file_path: str) -> str:
        """Extract plain text from PDF or TXT file."""
        ext = Path(file_path).suffix.lower()
        if ext == ".pdf":
            return FileService._extract_from_pdf(file_path)
        elif ext == ".txt":
            return FileService._extract_from_txt(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

    @staticmethod
    def _extract_from_pdf(file_path: str) -> str:
        reader = PdfReader(file_path)
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        return "\n".join(text_parts)

    @staticmethod
    def _extract_from_txt(file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
