"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Breadcrumbs } from "@/components/dashboard/Breadcrumbs";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "goya:sidebar:collapsed";

export default function DashboardClient({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Persisted sidebar collapse (back-compat with legacy 'sidebar_collapsed' key)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(SIDEBAR_KEY) ?? localStorage.getItem("sidebar_collapsed");
    if (saved) setCollapsed(saved === "1" || saved === "true");
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    }
  }, [collapsed]);

  return (
    <div className={cn("flex min-h-screen")}>
      {/* Skip-link for keyboard / screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-3 focus:py-2 focus:rounded-[var(--radius-md)] focus:bg-primary focus:text-primary-foreground focus:shadow-md focus:outline-none"
      >
        Saltar al contenido principal
      </a>

      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Breadcrumbs row */}
        <div className="px-6 md:px-8 pt-4">
          <Breadcrumbs />
        </div>

        <main
          id="main-content"
          className="flex-1 px-6 md:px-8 pb-8 max-w-[1600px] w-full mx-auto animate-fade-in-up"
          style={{ animationDuration: "0.4s" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
