import type { ReactNode } from "react";
import type { Resume } from "@/lib/api";

// The sheet stays white in dark mode too: it is a paper preview of the exported file.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="flex items-center gap-3">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700">{title}</h3>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Entry({ title, subtitle, meta, children }: {
  title: string; subtitle?: string; meta?: string; children?: ReactNode;
}) {
  return (
    <div className="relative border-l-2 border-slate-200 pb-5 pl-5 last:pb-0">
      <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="text-[15px] font-semibold text-slate-900">{title}</p>
        {meta && <p className="whitespace-nowrap text-xs font-medium text-slate-500">{meta}</p>}
      </div>
      {subtitle && <p className="text-sm font-medium text-amber-700">{subtitle}</p>}
      {children && <div className="mt-1.5 text-sm leading-relaxed text-slate-600">{children}</div>}
    </div>
  );
}

const icon = {
  mail: "M4 4h16v16H4z M4 6l8 7 8-7",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
  pin: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
};

function Contact({ path, text }: { path: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
        <path d={path} />
      </svg>
      {text}
    </span>
  );
}

export default function ResumePreview({ resume }: { resume: Resume }) {
  const empty =
    !resume.name && !resume.summary && !resume.skills.length && !resume.experience.length &&
    !resume.projects.length && !resume.education.length;

  return (
    <div className="rounded-xl border border-white/70 bg-white/50 p-3 shadow-inner backdrop-blur-sm dark:border-0 dark:bg-slate-800/60 dark:shadow-none sm:p-5">
      <article className="mx-auto min-h-[40rem] max-w-[820px] overflow-hidden rounded-md bg-white text-slate-800 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5">
        <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />

        {empty ? (
          <div className="flex h-[34rem] flex-col items-center justify-center px-6 text-center text-slate-400">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M8 13h8M8 17h5" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-500">Your resume will appear here</p>
            <p className="mt-1 text-xs">Tell the assistant about yourself to get started.</p>
          </div>
        ) : (
          <div className="px-8 pb-10 pt-8 sm:px-12">
            <header>
              <h2 className="text-4xl font-bold tracking-tight text-slate-900">
                {resume.name || "Your Name"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-600">
                {resume.email && <Contact path={icon.mail} text={resume.email} />}
                {resume.phone && <Contact path={icon.phone} text={resume.phone} />}
                {resume.location && <Contact path={icon.pin} text={resume.location} />}
              </div>
            </header>

            {resume.summary && (
              <Section title="Profile">
                <p className="text-sm leading-relaxed text-slate-600">{resume.summary}</p>
              </Section>
            )}

            {resume.skills.length > 0 && (
              <Section title="Skills">
                <div className="flex flex-wrap gap-2">
                  {resume.skills.map((s, i) => (
                    <span key={i} className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                      {s}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {resume.experience.length > 0 && (
              <Section title="Experience">
                {resume.experience.map((x, i) => (
                  <Entry
                    key={i}
                    title={x.role}
                    subtitle={x.company}
                    meta={[x.start_date, x.end_date].filter(Boolean).join(" – ")}
                  >
                    {x.description && <p>{x.description}</p>}
                  </Entry>
                ))}
              </Section>
            )}

            {resume.projects.length > 0 && (
              <Section title="Projects">
                {resume.projects.map((p, i) => (
                  <Entry key={i} title={p.name} subtitle={p.technologies.join(" · ")}>
                    {p.description && <p>{p.description}</p>}
                    {p.link && <p className="mt-1 break-all text-xs text-blue-600">{p.link}</p>}
                  </Entry>
                ))}
              </Section>
            )}

            {resume.education.length > 0 && (
              <Section title="Education">
                {resume.education.map((e, i) => (
                  <Entry
                    key={i}
                    title={e.degree}
                    subtitle={e.institution}
                    meta={[e.start_year, e.end_year].filter(Boolean).join(" – ")}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
