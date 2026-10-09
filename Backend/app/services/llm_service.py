"""Chat agent: Gemini + MCP tools. Gemini edits the resume by calling MCP tools."""
import copy

from google import genai
from google.genai import types

from app.core.config import settings
from app.mcp_client.client import ResumeMCPClient

SYSTEM_PROMPT = """You are a friendly resume-building assistant.
The user gives details (name, phone, email, skills, projects, experience, qualifications) in
plain text, possibly all at once. Save everything with the provided tools, never invent facts,
and ask for missing essentials (name, contact, at least one of experience/projects/education).
When the user wants a change, call the tools (use get_resume first if you need indexes to
remove an item). Keep replies short, and tell the user the resume preview is updated and can
be downloaded as PDF or DOCX."""


def _strip_session(schema: dict) -> dict:
    s = copy.deepcopy(schema)
    s.get("properties", {}).pop("session_id", None)
    if "session_id" in s.get("required", []):
        s["required"].remove("session_id")
    return s


class LLMService:
    def __init__(self, mcp: ResumeMCPClient) -> None:
        self.mcp = mcp
        self.client = genai.Client(api_key=settings.gemini_api_key or None)
        self.histories: dict[str, list[types.Content]] = {}

    def _config(self) -> types.GenerateContentConfig:
        decls = [
            types.FunctionDeclaration(
                name=t["name"],
                description=t["description"],
                parameters_json_schema=_strip_session(t["input_schema"]),
            )
            for t in self.mcp.tools
        ]
        return types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=[types.Tool(function_declarations=decls)],
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

    async def chat(self, session_id: str, message: str) -> str:
        history = self.histories.setdefault(session_id, [])
        history.append(types.Content(role="user", parts=[types.Part(text=message)]))
        config = self._config()

        for _ in range(settings.max_tool_rounds):
            resp = await self.client.aio.models.generate_content(
                model=settings.llm_model, contents=history, config=config,
            )
            if not resp.candidates or not resp.candidates[0].content:
                return "Sorry, I couldn't generate a response. Please try again."
            history.append(resp.candidates[0].content)

            calls = resp.function_calls or []
            if not calls:
                return (resp.text or "").strip()

            parts = []
            for call in calls:
                out = await self.mcp.call_tool(call.name, {**(call.args or {}), "session_id": session_id})
                parts.append(types.Part.from_function_response(name=call.name, response={"result": out}))
            history.append(types.Content(role="user", parts=parts))

        return "Sorry, I couldn't finish that request. Please try again."
