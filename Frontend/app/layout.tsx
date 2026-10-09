import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "AI Resume Builder" };

// Runs before paint so the saved theme is applied without a flash.
const themeScript = `
try {
  var t = localStorage.getItem("theme");
  if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/70 to-amber-50/60 bg-fixed text-slate-900 antialiased transition-colors dark:bg-none dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
