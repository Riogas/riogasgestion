"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { useTheme } from "@/lib/useTheme";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function DashboardClient({ children }: { children: ReactNode }) {
  const { theme } = useTheme(); // si necesitás el tema en el layout
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Breadcrumbs desde la ruta actual
  const pathSegments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment, index, array) => {
      const href = "/" + array.slice(0, index + 1).join("/");
      return {
        label: segment.charAt(0).toUpperCase() + segment.slice(1),
        href,
      };
    });

  // (Opcional) recordar colapsado del sidebar
  useEffect(() => {
    const saved = typeof window !== "undefined"
      ? localStorage.getItem("sidebar_collapsed")
      : null;
    if (saved) setCollapsed(saved === "1");
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar_collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  return (
    <div className={cn("flex min-h-screen")}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div className="flex flex-col flex-1">
        <div className="px-6 pt-4">
          <nav className="text-sm text-muted-foreground mb-4">
            <ol className="flex items-center space-x-2">
              <li>
                <Link href="/dashboard" className="hover:underline text-primary">
                  Inicio
                </Link>
              </li>
              {pathSegments.map((segment, index) => (
                <li key={segment.href} className="flex items-center">
                  <span className="mx-2">/</span>
                  {index === pathSegments.length - 1 ? (
                    <span className="text-foreground">{segment.label}</span>
                  ) : (
                    <Link href={segment.href} className="hover:underline text-primary">
                      {segment.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <main className="flex-1 px-6 pb-6">{children}</main>
      </div>
    </div>
  );
}
