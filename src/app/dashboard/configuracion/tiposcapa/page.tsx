"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import TiposCapa from "@/components/configuracion/TiposCapa";

export default function TiposCapaPage() {
  const router = useRouter();

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Administración de Tipos de Capa</h1>
      </div>
      <TiposCapa />
    </Card>
  );
}
