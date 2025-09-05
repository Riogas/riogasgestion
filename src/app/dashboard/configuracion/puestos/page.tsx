"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import Puestos from "@/components/configuracion/Puestos";

export default function PuestosPage() {
  const router = useRouter();

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Administración de Puestos</h1>
      </div>
      <Puestos />
    </Card>
  );
}
