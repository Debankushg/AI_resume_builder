export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Resume {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  experience: { company: string; role: string; start_date: string; end_date: string; description: string }[];
  projects: { name: string; description: string; technologies: string[]; link: string }[];
  education: { institution: string; degree: string; start_year: string; end_year: string }[];
}

export async function sendChat(sessionId: string, message: string): Promise<{ reply: string; resume: Resume }> {
  const res = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchResume(sessionId: string): Promise<Resume> {
  const res = await fetch(`${API}/api/resume/${sessionId}`);
  return res.json();
}

export async function download(sessionId: string, kind: "pdf" | "docx") {
  const res = await fetch(`${API}/api/resume/${sessionId}/${kind}`);
  if (!res.ok) throw new Error("Download failed");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `resume.${kind}`;
  a.click();
  URL.revokeObjectURL(url);
}
