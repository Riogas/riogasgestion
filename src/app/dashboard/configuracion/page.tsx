import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Departamentos from "@/components/configuracion/Departamentos";
import Localidades from "@/components/configuracion/Localidades";
import Calles from "@/components/configuracion/Calles";
import Usuarios from "@/components/configuracion/Usuarios";
import Roles from "@/components/configuracion/Roles";
import Permisos from "@/components/configuracion/Permisos";
import Zonificacion from "@/components/configuracion/Zonificacion";
import TiposCapa from "@/components/configuracion/TiposCapa";
import Capa from "@/components/configuracion/Capa";
import Zona from "@/components/configuracion/Zona";
import Puestos from "@/components/configuracion/Puestos";

/* Cada sección de configuración renderiza el mismo patrón: título +
 * descripción dentro de un Card con el componente correspondiente.
 * Centralizamos el patrón en SectionCard para evitar la repetición
 * y dejar los TabsContent declarativos. */
function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Catálogos, permisos, roles y configuración general del sistema."
      />
      <Tabs defaultValue="puestos" className="w-full">
        <TabsList className="overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="puestos">Puestos</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permisos">Permisos</TabsTrigger>
          <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
          <TabsTrigger value="localidades">Localidades</TabsTrigger>
          <TabsTrigger value="calles">Calles</TabsTrigger>
          <TabsTrigger value="zonificacion">Zonificación</TabsTrigger>
          <TabsTrigger value="tipos-capa">Tipos de Capa</TabsTrigger>
          <TabsTrigger value="capas">Capas</TabsTrigger>
          <TabsTrigger value="zonas">Zonas</TabsTrigger>
        </TabsList>

        <TabsContent value="puestos">
          <SectionCard
            title="Puestos"
            description="Administración de puestos de trabajo."
          >
            <Puestos />
          </SectionCard>
        </TabsContent>

        <TabsContent value="usuarios">
          <SectionCard
            title="Usuarios"
            description="Administración de usuarios del sistema y sus accesos."
          >
            <Usuarios />
          </SectionCard>
        </TabsContent>

        <TabsContent value="roles">
          <SectionCard
            title="Roles"
            description="Roles disponibles y agrupación de permisos."
          >
            <Roles />
          </SectionCard>
        </TabsContent>

        <TabsContent value="permisos">
          <SectionCard
            title="Permisos"
            description="Granularidad de permisos por pantalla y acción."
          >
            <Permisos />
          </SectionCard>
        </TabsContent>

        <TabsContent value="departamentos">
          <SectionCard
            title="Departamentos"
            description="Catálogo de departamentos (división administrativa)."
          >
            <Departamentos />
          </SectionCard>
        </TabsContent>

        <TabsContent value="localidades">
          <SectionCard
            title="Localidades"
            description="Catálogo de localidades por departamento."
          >
            <Localidades />
          </SectionCard>
        </TabsContent>

        <TabsContent value="calles">
          <SectionCard
            title="Calles"
            description="Catálogo de calles y normalización."
          >
            <Calles />
          </SectionCard>
        </TabsContent>

        <TabsContent value="zonificacion">
          <SectionCard
            title="Zonificación"
            description="División del territorio de servicio en zonas operativas."
          >
            <Zonificacion />
          </SectionCard>
        </TabsContent>

        <TabsContent value="tipos-capa">
          <SectionCard
            title="Tipos de Capa"
            description="Tipos disponibles para capas del mapa (zonas, rutas, áreas)."
          >
            <TiposCapa />
          </SectionCard>
        </TabsContent>

        <TabsContent value="capas">
          <SectionCard
            title="Capas"
            description="Capas geográficas del mapa, con su tipo y atributos."
          >
            <Capa />
          </SectionCard>
        </TabsContent>

        <TabsContent value="zonas">
          <SectionCard
            title="Zonas"
            description="Zonas geográficas específicas (residenciales, comerciales, etc)."
          >
            <Zona />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
