"use client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import Usuarios from "@/components/dashboard/usuarios/Usuarios";

export default function UsuariosPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración de Usuarios"
        description="Alta, edición, permisos y roles del personal."
        actions={
          <Button onClick={() => router.push("/dashboard/usuarios/crear")}>
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo
          </Button>
        }
      />
      <Usuarios />
    </div>
  );
}
