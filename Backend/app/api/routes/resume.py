from fastapi import APIRouter, HTTPException, Response

from app.schemas.resume import ResumeData
from app.services.docx_generator import build_docx
from app.services.pdf_generator import build_pdf
from app.services.resume_store import load_resume

router = APIRouter(prefix="/api/resume", tags=["resume"])


def _load(session_id: str) -> ResumeData:
    try:
        return load_resume(session_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{session_id}", response_model=ResumeData)
def get_resume(session_id: str):
    return _load(session_id)


@router.get("/{session_id}/pdf")
def download_pdf(session_id: str):
    return Response(
        build_pdf(_load(session_id)), media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="resume.pdf"'},
    )


@router.get("/{session_id}/docx")
def download_docx(session_id: str):
    return Response(
        build_docx(_load(session_id)),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="resume.docx"'},
    )
