# Backend Architecture

## 1. Folder structure

```
Backend/
├── app/
│   ├── main.py                  # 1. App entry point: startup, CORS, routers
│   ├── core/
│   │   └── config.py            # Settings from .env (GEMINI_API_KEY, LLM_MODEL…)
│   ├── api/routes/
│   │   ├── chat.py              # POST /api/chat        (the chatbot endpoint)
│   │   └── resume.py            # GET  /api/resume/{id}, /pdf, /docx
│   ├── services/
│   │   ├── llm_service.py       # The "brain": talks to Gemini, runs the tool loop
│   │   ├── resume_store.py      # Reads/writes Backend/data/resumes/<session>.json
│   │   ├── pdf_generator.py     # ResumeData -> PDF bytes (reportlab)
│   │   └── docx_generator.py    # ResumeData -> DOCX bytes (python-docx)
│   ├── mcp_client/
│   │   └── client.py            # Starts the MCP server, lists + calls its tools
│   ├── mcp_server/
│   │   └── server.py            # The "hands": tools that edit the resume
│   └── schemas/
│       └── resume.py            # Pydantic models (ResumeData, ChatRequest…)
└── data/resumes/                # One JSON file per user session
```

## 2. Block diagram

```
 ┌────────────────────┐
 │  Browser (Next.js) │
 │  chat box + preview│
 └─────────┬──────────┘
           │ ① POST /api/chat {session_id, message}
           │ ⑧ {reply, resume}
           ▼
 ┌───────────────────────────────────────────────────────────────┐
 │                  FastAPI process  (uvicorn)                   │
 │                                                               │
 │  main.py ──► routes/chat.py ──► services/llm_service.py       │
 │  (startup)    ② validate         ③ builds prompt + tool list  │
 │                                      │            ▲           │
 │                                      │ ④ prompt   │ ⑤ reply   │
 │                                      │ + tools    │ OR        │
 │                                      ▼            │ "call tool│
 │                              ┌──────────────┐     │  X(args)" │
 │                              │ Gemini API   │─────┘           │
 │                              │ (Google LLM) │                 │
 │                              └──────────────┘                 │
 │                                      │ ⑥ tool request         │
 │                                      ▼                        │
 │                          mcp_client/client.py                 │
 │                                      │                        │
 └──────────────────────────────────────┼────────────────────────┘
                                        │ MCP over stdio (JSON-RPC)
                                        │ (a separate child process)
                                        ▼
 ┌───────────────────────────────────────────────────────────────┐
 │        MCP server process: mcp_server/server.py               │
 │  tools: get_resume, update_personal_info, add_skills,         │
 │         add_experience, add_project, add_education, remove_item│
 └──────────────────────────────┬────────────────────────────────┘
                                │ ⑦ load / save
                                ▼
                 services/resume_store.py ⇄ data/resumes/<id>.json
                                ▲
                                │ also read by
   routes/resume.py ──► pdf_generator.py / docx_generator.py  (downloads)
```

## 3. Key idea: who does what

| Piece | Role | Analogy |
|---|---|---|
| **Gemini (LLM)** | Understands free text, decides *which tool to call and with what arguments*. It never touches files. | The brain |
| **MCP server** | Exposes a fixed list of safe tools that actually modify the resume. | The hands |
| **MCP client** | Lets FastAPI connect to the MCP server, list its tools and call them. | The nervous system |
| **llm_service.py** | Runs the loop: ask Gemini → run tools → give results back → repeat. | The coordinator |
| **JSON file** | The single source of truth for a user's resume. | The memory |

The LLM only **returns text saying "please call `add_skills` with `['Python']`"**.
Our code performs the call. That is what "tool calling" / "function calling" means.

## 4. Step by step

### Step A: server startup (`app/main.py`)

You run `uvicorn app.main:app`. uvicorn imports `app` from `main.py`.

1. `FastAPI(..., lifespan=lifespan)` is created. The `lifespan` function runs **once at startup**.
2. Inside it: `mcp = ResumeMCPClient(); await mcp.start()`
   - `client.py` launches a **child process**: `python -m app.mcp_server.server`
     (that is why you see `Processing request of type ListToolsRequest` in your terminal).
   - The two sides talk over the child's stdin/stdout using JSON-RPC (the MCP protocol).
   - `session.initialize()` is the handshake, then `list_tools()` asks the server
     "what can you do?" and stores the 7 tool names + descriptions + JSON schemas in `mcp.tools`.
3. `app.state.llm = LLMService(mcp)` creates the Gemini client and keeps the MCP client.
   Stored on `app.state` so every request can reach it.
4. CORS middleware allows the frontend (`localhost:3000`) to call the API.
5. The two routers (`chat`, `resume`) are registered.
6. On shutdown, `mcp.stop()` kills the child process.

### Step B: a user sends a message

Example input: **"I'm Jane Doe, phone 555-1234, skills Python and React"**

**① Browser → `POST /api/chat`**
`lib/api.ts` sends `{ session_id: "65dd…", message: "I'm Jane Doe…" }`.
`session_id` is a UUID the frontend makes once and keeps in `localStorage`; it is how we
keep each user's resume separate.

**② `api/routes/chat.py`**
- FastAPI validates the body against `ChatRequest` (`schemas/resume.py`).
- Checks `GEMINI_API_KEY` exists, else returns 500 with a clear message.
- Calls `request.app.state.llm.chat(session_id, message)`.
- Gemini errors are caught and returned as 502 with Google's message.

**③ `services/llm_service.py` → `chat()` prepares the request**
- Appends the user message to `self.histories[session_id]` (conversation memory, in RAM).
- Builds the config:
  - `system_instruction`: the rules ("save everything with tools, never invent facts…").
  - `tools`: the 7 MCP tools converted to Gemini "function declarations".
    `session_id` is **removed from their schemas**, so Gemini doesn't see or invent it.
  - automatic function calling is **disabled**, because we run the loop ourselves.

**④ Call Gemini**
`generate_content(model, contents=history, config=config)` sends: system prompt +
history + tool list.

**⑤ Gemini decides**
It reads the text and replies *not with prose but with function calls*, for example:
```
update_personal_info(name="Jane Doe", phone="555-1234")
add_skills(skills=["Python", "React"])
```
`resp.function_calls` is non-empty, so the loop continues. (If it were empty, the text
reply is final and we return it.)

**⑥ We run the tools through MCP**
For each call, `llm_service` does:
```python
self.mcp.call_tool(call.name, {**call.args, "session_id": session_id})
```
- **`session_id` is injected by our code**, not by the LLM. A prompt can never make the
  model edit someone else's resume.
- `client.py` sends the call to the MCP server process over stdio.

**⑦ MCP server executes (`mcp_server/server.py`)**
Each tool is a plain Python function decorated with `@mcp.tool()`:
`load_resume(session_id)` → change the field → `save_resume(session_id, r)` →
return the updated resume. `resume_store.py` reads/writes `data/resumes/<id>.json`
and validates the data using the Pydantic `ResumeData` model.

The result string goes back through the client to `llm_service`.

**Loop again.** Results are added to history as a `function_response` message, and we call
Gemini again (up to 8 rounds, `max_tool_rounds`). Gemini now sees "tools succeeded" and
answers in plain text:
> "Done! I've added your name, phone and skills. Add your experience next?"

No more function calls → `chat()` returns that text.

**⑧ Response**
`chat.py` re-reads the JSON file with `load_resume()` and returns
`ChatResponse { reply, resume }`. The frontend shows the reply in the chat and
re-renders the preview from `resume`. This is why "update my phone number" works: the
model calls `update_personal_info(phone=…)` and the preview refreshes.

### Step C: downloading

`GET /api/resume/{session_id}/pdf` (or `/docx`) → `routes/resume.py` →
`load_resume()` → `build_pdf()` / `build_docx()` → returns the file bytes with a
`Content-Disposition: attachment` header. The LLM and MCP are **not involved**; the
file is built from the saved JSON, so it always matches the preview.

## 5. Sequence diagram (one chat message)

```
Browser     chat.py     llm_service     Gemini     mcp_client     MCP server     JSON file
   │ POST /chat │            │            │            │              │             │
   │───────────►│ chat()     │            │            │              │             │
   │            │───────────►│ prompt+tools            │              │             │
   │            │            │───────────►│            │              │             │
   │            │            │◄───────────│ call add_skills(...)      │             │
   │            │            │ call_tool(+session_id)  │              │             │
   │            │            │────────────────────────►│─────────────►│ load/save   │
   │            │            │            │            │              │────────────►│
   │            │            │◄────────────────────────│◄─────────────│ updated     │
   │            │            │ function_response       │              │             │
   │            │            │───────────►│            │              │             │
   │            │            │◄───────────│ "Done! …" (text)          │             │
   │            │◄───────────│ reply      │            │              │             │
   │            │ load_resume() ──────────────────────────────────────────────────►│
   │◄───────────│ {reply, resume}         │            │              │             │
```

## 6. Design decisions

- **Why MCP instead of calling functions directly?** The tools live in their own process
  behind a standard protocol. The same `server.py` could be plugged into other MCP clients
  (e.g. Claude Desktop) unchanged, and the LLM can only do what the tools allow.
- **Why a JSON file?** Both the FastAPI process and the MCP child process need the same
  data. A file is the simplest shared store. For production, swap `resume_store.py`
  for a database; nothing else changes.
- **Why inject `session_id`?** Security and simplicity. The model never handles identity.
- **Chat history vs resume data:** chat history is in memory (lost on restart). The resume
  is in the JSON file (persistent), so a restart keeps the resume but not the conversation.

## 7. How to extend

| Goal | Change |
|---|---|
| New resume section (e.g. certifications) | Add a model to `schemas/resume.py`, a tool in `mcp_server/server.py`, render it in both generators. The LLM picks it up automatically. |
| Different LLM | Only `services/llm_service.py` changes. |
| Real database | Only `services/resume_store.py` changes. |
