"use client";
import { useLoading } from "@/lib/LoadingContext";

export default function GlobalLoader() {
  const { isLoading, message } = useLoading();
  if (!isLoading) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/60 backdrop-blur-md animate-fade-in-up">
      <div className="surface-glass flex items-center gap-3 rounded-[var(--radius-lg)] text-foreground px-5 py-3 shadow-lg">
        {/* Gradient spinner SVG */}
        <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="goya-spin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="9" stroke="var(--muted)" strokeWidth="2.5" />
          <path d="M21 12 A9 9 0 0 0 12 3" stroke="url(#goya-spin)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="text-sm">{message || "Cargando..."}</span>
      </div>
    </div>
  );
}
