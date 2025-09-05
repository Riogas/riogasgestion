"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import Permisos from "@/components/configuracion/Permisos";

export default function PermisosPage() {
  const router = useRouter();

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Administración de Permisos</h1>
      </div>
      <Permisos />
    </Card>
  );
}
