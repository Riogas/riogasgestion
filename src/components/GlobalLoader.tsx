"use client";
import { useLoading } from "@/lib/LoadingContext";
import { Loader2 } from "lucide-react";

export default function GlobalLoader() {
  const { isLoading, message } = useLoading();
  if (!isLoading) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-xl bg-card text-foreground border border-border px-5 py-3 shadow-xl">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm">{message || "Cargando..."}</span>
      </div>
    </div>
  );
}
