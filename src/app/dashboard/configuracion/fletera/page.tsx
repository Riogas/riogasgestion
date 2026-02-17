"use client";

import { Card } from "@/components/ui/card";
import Fleteras from "@/components/configuracion/Fleteras";

export default function FleterasPage() {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Administración de Fleteras</h1>
      </div>
      <Fleteras />
    </Card>
  );
}
