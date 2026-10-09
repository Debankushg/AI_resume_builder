from fastapi import APIRouter, HTTPException, Request
from google.genai.errors import APIError

from app.schemas.resume import ChatRequest, ChatResponse
from app.services.resume_store import load_resume

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, request: Request):
    from app.core.config import settings

    if not settings.gemini_api_key:
        raise HTTPException(500, "GEMINI_API_KEY is not set in Backend/.env")
    try:
        reply = await request.app.state.llm.chat(body.session_id, body.message)
        return ChatResponse(reply=reply, resume=load_resume(body.session_id))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except APIError as e:
        raise HTTPException(502, f"Gemini error {e.code}: {e.message}")
