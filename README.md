# AI Resume Builder

Chat with an AI assistant to build and keep updating your resume. Tell it your name, phone,
skills, projects, experience and qualifications in plain text, watch a live preview update, and
download the result as **PDF** or **DOCX**.

- **`Frontend/`**: Next.js 14 (App Router) + Tailwind CSS. Chat UI, live resume preview, light/dark theme.
- **`Backend/`**: Python FastAPI + Google Gemini (free tier) + an MCP server and client. The LLM edits the resume by calling MCP tools.

---

## Table of contents

1. [Features](#1-features)
2. [Tech stack](#2-tech-stack)
3. [Project structure](#3-project-structure)
4. [Setup and run](#4-setup-and-run)
5. [Environment variables](#5-environment-variables)
6. [Backend architecture](#6-backend-architecture)
7. [Step-by-step flow](#7-step-by-step-flow)
8. [API reference](#8-api-reference)
9. [Frontend overview](#9-frontend-overview)
10. [Design decisions](#10-design-decisions)
11. [How to extend](#11-how-to-extend)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Features

- Conversational resume building: give details in free text, all at once or piece by piece.
- Update anything later ("change my phone to…", "remove the second project"); the resume is rebuilt every time.
- Live, paper-style resume preview.
- Download as **PDF** or **DOCX**.
- Per-user sessions (each browser gets its own resume).
- Light and dark mode with a toggle icon (remembers your choice, follows system theme on first visit).
- Layout fits the screen: chat and preview scroll independently, with slim glass-style scrollbars.
- Gold download buttons, gradient accents and a frosted-glass look in light mode.

## 2. Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS 3 |
| Backend API | FastAPI, Uvicorn, Pydantic v2, pydantic-settings |
| LLM | Google Gemini via `google-genai` (free tier, default model `gemini-3.8-flash`) |
| Tool protocol | MCP (`mcp>=1.2,<2`): FastMCP server + stdio client |
| Documents | `reportlab` (PDF), `python-docx` (DOCX) |
| Storage | One JSON file per session in `Backend/data/resumes/` |

## 3. Project structure

```
resume_builder/
├── README.md                    # this file
├── .gitignore
├── Backend/
│   ├── requirements.txt
│   ├── .env.example             # copy to .env
│   ├── ARCHITECTURE.md          # same architecture notes as section 6-7
│   ├── data/resumes/            # <session_id>.json files (git-ignored)
│   └── app/
│       ├── main.py              # App entry point: startup (MCP), CORS, routers
│       ├── core/
│       │   └── config.py        # Settings loaded from .env
│       ├── api/routes/
│       │   ├── chat.py          # POST /api/chat
│       │   └── resume.py        # GET /api/resume/{id}, /pdf, /docx
│       ├── services/
│       │   ├── llm_service.py   # Gemini + tool-calling loop (the "brain")
│       │   ├── resume_store.py  # Read/write the JSON resume files
│       │   ├── pdf_generator.py # ResumeData -> PDF bytes
│       │   └── docx_generator.py# ResumeData -> DOCX bytes
│       ├── mcp_client/
│       │   └── client.py        # Spawns the MCP server, lists/calls tools
│       ├── mcp_server/
│       │   └── server.py        # MCP tools that edit the resume (the "hands")
│       └── schemas/
│           └── resume.py        # Pydantic models
└── Frontend/
    ├── package.json, tsconfig.json, next.config.js
    ├── tailwind.config.js       # darkMode: "class"
    ├── postcss.config.js
    ├── .env.local.example       # copy to .env.local
    ├── app/
    │   ├── layout.tsx           # HTML shell + no-flash theme script
    │   ├── page.tsx             # Main page: chat, preview, download buttons
    │   └── globals.css          # Tailwind + glass scrollbars
    ├── components/
    │   ├── ResumePreview.tsx    # Paper-style resume preview
    │   └── ThemeToggle.tsx      # Sun/moon light-dark switch
    └── lib/
        └── api.ts               # API calls (chat, fetch resume, download)
```

## 4. Setup and run

**Prerequisites:** Python 3.10+, Node.js 18+, and a free Gemini API key from
<https://aistudio.google.com/apikey>.

### Backend

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then edit .env and set GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

API: <http://localhost:8000> · interactive docs: <http://localhost:8000/docs>

### Frontend

```bash
cd Frontend
npm install
cp .env.local.example .env.local
npm run dev
```

App: <http://localhost:3000>

Run the two in separate terminals. Backend first.

## 5. Environment variables

**`Backend/.env`**

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | (none, required) | Free key from Google AI Studio |
| `LLM_MODEL` | `gemini-3.8-flash` | Gemini model name |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list of allowed frontend origins |

**`Frontend/.env.local`**

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL |

## 6. Backend architecture

### Who does what

| Piece | Role | Analogy |
|---|---|---|
| **Gemini (LLM)** | Understands free text and decides *which tool to call with which arguments*. It never touches files. | The brain |
| **MCP server** | Exposes a fixed list of safe tools that actually modify the resume. | The hands |
| **MCP client** | Lets FastAPI connect to the MCP server, list its tools and call them. | The nervous system |
| **`llm_service.py`** | Runs the loop: ask Gemini → run tools → give results back → repeat. | The coordinator |
| **JSON file** | The single source of truth for a user's resume. | The memory |

The LLM only *returns a request* such as "please call `add_skills` with `['Python']`".
Our code performs the call. That is what tool calling (function calling) means.

### Block diagram

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

### MCP tools

| Tool | Purpose |
|---|---|
| `get_resume` | Return the current resume |
| `update_personal_info` | Set name, email, phone, location, summary (only provided fields change) |
| `add_skills` | Add skills (duplicates ignored) |
| `add_experience` | Add a work entry (company, role, dates, description) |
| `add_project` | Add a project (name, description, technologies, link) |
| `add_education` | Add a qualification (institution, degree, years) |
| `remove_item` | Remove an item by index from skills / experience / projects / education |

All tools take a `session_id`, which is injected by the backend, never by the LLM.

### Data model (`schemas/resume.py`)

```
ResumeData
├── name, email, phone, location, summary
├── skills:      [str]
├── experience:  [{company, role, start_date, end_date, description}]
├── projects:    [{name, description, technologies[], link}]
└── education:   [{institution, degree, start_year, end_year}]
```

## 7. Step-by-step flow

### A. Server startup (`app/main.py`)

`uvicorn app.main:app` imports `app`. The `lifespan` function runs once at startup:

1. `ResumeMCPClient().start()` launches a child process: `python -m app.mcp_server.server`.
   The two talk over stdin/stdout using the MCP protocol (JSON-RPC). This is the
   `Processing request of type ListToolsRequest` line you see in the terminal.
2. `initialize()` is the handshake. `list_tools()` asks "what can you do?" and stores the 7
   tool names, descriptions and JSON schemas in `mcp.tools`.
3. `app.state.llm = LLMService(mcp)` creates the Gemini client and holds the MCP client.
4. CORS middleware allows the frontend origin; the `chat` and `resume` routers are registered.
5. On shutdown, the MCP child process is stopped.

### B. A user sends a message

Example: **"I'm Jane Doe, phone 555-1234, skills Python and React"**

1. **Browser → `POST /api/chat`.** `lib/api.ts` sends `{session_id, message}`. The `session_id`
   is a UUID created once and stored in `localStorage`; it keeps each user's resume separate.
2. **`routes/chat.py`.** Validates the body (`ChatRequest`), checks `GEMINI_API_KEY`, calls
   `llm.chat(session_id, message)`. Gemini errors are returned as a readable 502.
3. **`llm_service.chat()` prepares the request.** Appends the message to
   `histories[session_id]` (conversation memory, in RAM). Builds the config: the system prompt,
   the 7 MCP tools as Gemini function declarations (with `session_id` removed from their
   schemas), and automatic function calling disabled because we run the loop ourselves.
4. **Call Gemini.** `generate_content(model, contents=history, config=config)`.
5. **Gemini decides.** It replies with function calls rather than prose, for example
   `update_personal_info(name="Jane Doe", phone="555-1234")` and `add_skills(["Python","React"])`.
   If there are no function calls, its text is the final answer.
6. **Run the tools via MCP.** For each call:
   `mcp.call_tool(name, {**args, "session_id": session_id})`. The client sends it to the MCP
   server process over stdio.
7. **MCP server executes.** The tool function does `load_resume(session_id)` → change the
   field → `save_resume(session_id, r)` → return the updated resume. `resume_store.py`
   reads/writes `data/resumes/<id>.json`, validated by `ResumeData`.
8. **Loop.** The results go back to Gemini as `function_response` messages and we call it
   again (max 8 rounds, `max_tool_rounds`). Now Gemini answers in plain text, e.g.
   "Done! I've added your name, phone and skills. Want to add experience next?"
9. **Response.** `chat.py` re-reads the JSON with `load_resume()` and returns
   `{reply, resume}`. The frontend shows the reply and re-renders the preview.

### C. Downloading

`GET /api/resume/{session_id}/pdf` (or `/docx`) → `routes/resume.py` → `load_resume()` →
`build_pdf()` / `build_docx()` → file bytes with `Content-Disposition: attachment`.
The LLM and MCP are not involved, so the file always matches the saved data.

### D. Sequence diagram (one chat message)

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

## 8. API reference

| Method | Path | Body / Response |
|---|---|---|
| `POST` | `/api/chat` | Body `{session_id, message}` → `{reply, resume}` |
| `GET` | `/api/resume/{session_id}` | → `ResumeData` JSON |
| `GET` | `/api/resume/{session_id}/pdf` | → `resume.pdf` download |
| `GET` | `/api/resume/{session_id}/docx` | → `resume.docx` download |
| `GET` | `/health` | → `{"status": "ok"}` |

`session_id` must match `[A-Za-z0-9_-]{1,64}` (prevents path tricks in file names).
Errors: `400` invalid session id, `500` missing API key, `502` Gemini API error.

## 9. Frontend overview

- **`app/page.tsx`**: two-panel layout. Left: chat (message list + textarea, Enter to send,
  Shift+Enter for a new line, typing indicator). Right: live preview with gold
  **Download PDF** / **Download DOCX** buttons. On desktop the page fits the viewport and each
  panel scrolls independently; on small screens the panels stack.
- **`components/ResumePreview.tsx`**: white paper sheet (stays white in dark mode because it
  mirrors the exported file): gold top strip, large name, icon contact row, timeline-style
  experience/projects/education, skill badges, empty state.
- **`components/ThemeToggle.tsx`**: sun/moon icon button; adds/removes the `dark` class on
  `<html>` and stores the choice in `localStorage`. An inline script in `layout.tsx` applies it
  before first paint to avoid a flash.
- **`lib/api.ts`**: `sendChat`, `fetchResume`, `download` (fetches a blob and triggers the save).
- **`app/globals.css`**: Tailwind layers plus slim, translucent glass scrollbars
  (Firefox falls back to a plain thin scrollbar).

## 10. Design decisions

- **Why MCP instead of calling functions directly?** The tools live in their own process behind
  a standard protocol. The same `server.py` can be reused by other MCP clients (for example
  Claude Desktop), and the LLM can only do what the tools allow.
- **Why a JSON file?** The FastAPI process and the MCP child process both need the same data;
  a file is the simplest shared store.
- **Why inject `session_id`?** Security and simplicity. The model never handles identity, so a
  prompt cannot make it edit another user's resume.
- **Chat history vs resume data.** History is in RAM and is lost on restart; the resume is in
  the JSON file and persists.
- **Manual tool loop.** Automatic function calling is disabled so tool calls go through the
  MCP client instead of local Python functions.

### Why this project does not use RAG

RAG (retrieval-augmented generation) fetches relevant pieces from a large body of text, such as
documents or a knowledge base, and gives them to the LLM. It is worth it when the data is too big
to fit in the prompt or when answers must be grounded in many outside documents. It is not needed
here:

- **The data is tiny.** One resume is a few hundred to a few thousand words. The model reads the
  whole thing with `get_resume` whenever it needs it, so there is nothing to search.
- **The data is structured.** It is a fixed JSON shape (name, skills, experience, …) and the MCP
  tools read and write exact fields. That is more precise than a similarity search over text chunks.
- **There is no outside knowledge to retrieve.** The assistant works from what the user typed, and
  the system prompt tells it never to invent facts.
- **It would add cost and risk.** RAG means an embedding model, a vector database and extra
  latency, and it can return the wrong chunk, which would make answers worse.

**When RAG would make sense later:**

| Scenario | Why retrieval helps |
|---|---|
| Importing many old resumes or PDFs, then asking "what did I do at my second job?" | Too much text to put in every prompt |
| Matching the resume to a large set of job descriptions or a company knowledge base | Needs search across many documents |
| Drawing on a big library of resume guidelines or role-specific examples | Needs the most relevant guidance per request |

For "tailor my resume to this job description", RAG is still not needed: paste the description
into the prompt, since it fits easily. Consider RAG only when there is a document set the model
cannot read in one go.

## 11. How to extend

| Goal | Change |
|---|---|
| New resume section (e.g. certifications) | Add a model in `schemas/resume.py`, a tool in `mcp_server/server.py`, render it in `pdf_generator.py`, `docx_generator.py` and `ResumePreview.tsx`. The LLM picks up new tools automatically. |
| Different LLM | Only `services/llm_service.py` changes. |
| Real database | Only `services/resume_store.py` changes. |
| Make PDF/DOCX match the preview styling | Update `pdf_generator.py` / `docx_generator.py`. |
| Deploy | Set `CORS_ORIGINS` to the real frontend URL and `NEXT_PUBLIC_API_URL` to the real backend URL. |

## 12. Troubleshooting

| Problem | Cause and fix |
|---|---|
| `uvicorn: No such option '--reload--8000'` | Typo. Use `uvicorn app.main:app --reload --port 8000`. |
| `No module named 'mcp.server.fastmcp'` | `mcp` 2.x renamed the API. Use the pinned `mcp>=1.2,<2` from `requirements.txt`. |
| `404 … gemini-2.5-flash is no longer available to new users` | Set `LLM_MODEL=gemini-3.8-flash` in `Backend/.env` and restart. To list models for your key: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"`. |
| `GEMINI_API_KEY is not set` | Create `Backend/.env` from `.env.example` and add your key. |
| 429 / quota errors | Free-tier rate limits. Wait a bit and retry. |
| `destroy is not a function` (React) | A `useEffect` returned a non-function. Effects must use a block body and return nothing. Fixed in `page.tsx`. |
| Frontend can't reach backend / CORS error | Check the backend is running on port 8000, `NEXT_PUBLIC_API_URL` matches, and `CORS_ORIGINS` includes the frontend origin. |
| `.env` changes ignored | Restart uvicorn. Also make sure each variable is on its own line and the name is `LLM_MODEL` (not `GEMINI_MODEL`). |
