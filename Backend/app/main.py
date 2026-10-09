from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import chat, resume
from app.core.config import settings
from app.mcp_client.client import ResumeMCPClient
from app.services.llm_service import LLMService


@asynccontextmanager
async def lifespan(app: FastAPI):
    mcp = ResumeMCPClient()
    await mcp.start()
    app.state.llm = LLMService(mcp)
    yield
    await mcp.stop()


app = FastAPI(title="Resume Builder API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chat.router)
app.include_router(resume.router)


@app.get("/health")
def health():
    return {"status": "ok"}
