"""File-backed resume storage.

Shared by the FastAPI app and the MCP server subprocess, so both see the same
data without needing a database.
"""
import re

from app.core.config import settings
from app.schemas.resume import ResumeData

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _path(session_id: str):
    if not _SAFE_ID.match(session_id):
        raise ValueError("Invalid session id")
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    return settings.data_dir / f"{session_id}.json"


def load_resume(session_id: str) -> ResumeData:
    p = _path(session_id)
    if not p.exists():
        return ResumeData()
    return ResumeData.model_validate_json(p.read_text(encoding="utf-8"))


def save_resume(session_id: str, resume: ResumeData) -> None:
    _path(session_id).write_text(resume.model_dump_json(indent=2), encoding="utf-8")
