// ❌ no "use client" aquí: Server Component
import type { ReactNode } from "react";
import NavbarServer from "@/components/dashboard/NavbarServer";
import DashboardClient from "./DashboardClient"; // wrapper cliente

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen transition-colors duration-300 bg-background text-foreground">
      {/* Columna principal */}
      <div className="flex flex-col flex-1">
        {/* Navbar con datos de pantalla/usuario/fecha desde middleware */}
        <NavbarServer />
        {/* Resto (sidebar colapsable, breadcrumbs, contenido) */}
        <DashboardClient>{children}</DashboardClient>
      </div>
    </div>
  );
}
