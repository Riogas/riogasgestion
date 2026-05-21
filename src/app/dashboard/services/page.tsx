"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import Services from "@/components/dashboard/services/Services";

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Servicios técnicos y mantenimientos programados."
      />
      <Services />
    </div>
  );
}
