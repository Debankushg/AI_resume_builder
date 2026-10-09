"use client";

import { useEffect, useRef, useState } from "react";
import ResumePreview from "@/components/ResumePreview";
import ThemeToggle from "@/components/ThemeToggle";
import { download, fetchResume, sendChat, type Resume } from "@/lib/api";

const EMPTY: Resume = {
  name: "", email: "", phone: "", location: "", summary: "",
  skills: [], experience: [], projects: [], education: [],
};

type Msg = { role: "user" | "bot"; text: string };

export default function Home() {
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "bot", text: "Hi! Tell me your name, phone, skills, projects, experience and qualifications. You can update anything later." },
  ]);
  const [input, setInput] = useState("");
  const [resume, setResume] = useState<Resume>(EMPTY);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let id = localStorage.getItem("resume_session");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("resume_session", id);
    }
    setSessionId(id);
    fetchResume(id).then(setResume).catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function submit() {
    const text = input.trim();
    if (!text || loading || !sessionId) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const data = await sendChat(sessionId, text);
      setMessages((m) => [...m, { role: "bot", text: data.reply }]);
      setResume(data.resume);
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: `Error: ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  const dlBtn =
    "inline-flex items-center gap-2 rounded-lg border border-amber-300/60 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 px-4 py-2 text-sm font-semibold text-amber-950 shadow-md shadow-amber-500/30 transition hover:from-amber-200 hover:via-amber-300 hover:to-amber-500 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950";

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <header className="z-10 shrink-0 border-b border-white/60 bg-white/70 shadow-[0_1px_20px_rgba(59,130,246,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M8 13h8M8 17h5" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">AI Resume Builder</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Chat to build and update your resume</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 p-6 lg:min-h-0 lg:grid-cols-2 lg:grid-rows-1">
        <section className="flex h-[80vh] min-h-0 flex-col rounded-xl overflow-hidden lg:h-full border border-white/70 bg-white/80 shadow-xl shadow-blue-900/5 ring-1 ring-slate-900/5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900 dark:shadow-none dark:ring-0">
          <div className="shrink-0 flex items-center gap-2 border-b border-slate-200/70 bg-gradient-to-r from-blue-50/80 to-transparent px-5 py-3 text-sm font-semibold dark:border-slate-800 dark:bg-none"><span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />Assistant</div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-sm bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                    : "rounded-bl-sm border border-slate-200/70 bg-white text-slate-700 shadow-sm dark:border-0 dark:bg-slate-800 dark:text-slate-100 dark:shadow-none"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex">
                <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-slate-200/70 bg-white px-4 py-3 shadow-sm dark:border-0 dark:bg-slate-800">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="shrink-0 border-t border-slate-200/70 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-transparent">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={4}
              placeholder="e.g. I'm Jane Doe, phone 555-1234, skills Python, React. 3 years at Acme as developer…"
              className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-inner shadow-slate-100 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">Enter to send · Shift+Enter for new line</span>
              <button
                onClick={submit}
                disabled={loading || !input.trim()}
                className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/30 transition hover:from-blue-600 hover:to-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </section>

        <section className="flex h-[85vh] min-h-0 flex-col lg:h-full">
          <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Live preview</h2>
            <div className="flex gap-2">
              <button onClick={() => download(sessionId, "pdf")} className={`${dlBtn}`}>
                Download PDF
              </button>
              <button onClick={() => download(sessionId, "docx")} className={`${dlBtn}`}>
                Download DOCX
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl">
            <ResumePreview resume={resume} />
          </div>
        </section>
      </main>
    </div>
  );
}
