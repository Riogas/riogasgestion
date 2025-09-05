"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import Roles from "@/components/configuracion/Roles";

export default function RolesPage() {
  const router = useRouter();

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Administración de Roles</h1>
      </div>
      <Roles />
    </Card>
  );
}
