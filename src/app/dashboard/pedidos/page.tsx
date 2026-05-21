"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import Pedidos from "@/components/dashboard/pedidos/Pedidos";

export default function PedidosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Gestión y seguimiento de pedidos del día."
      />
      <Pedidos />
    </div>
  );
}
