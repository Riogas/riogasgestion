"use client";

import React, { Fragment, useEffect, useState } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle, Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import dynamic from "next/dynamic";
import { Dialog, Transition } from "@headlessui/react";
import { Pencil, Trash } from "lucide-react";
import { Combobox } from "@headlessui/react";
import Mapa from "@/components/mapa/OpenStreetMap";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { apiGetCapaGoya } from "@/services/api";
import { GenexusFeatureCollectionToGeoJson } from "@/lib/convertirGeoJson";
import { point as turfPoint } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { toast } from "sonner"; // Para notificaciones visuales
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelefonosTable, Telefono } from "./TelefonosTable";
import { DireccionesTable, DireccionRow } from "./DireccionesTable";
import { DireccionEditor, Direccion } from "./DireccionEditor";

// Cargamos el mapa dinámicamente (por ahora sin SSR)
const DynamicMapa = dynamic(() => import("@/components/mapa/OpenStreetMap"), {
  ssr: false,
});

interface ClienteFormProps {
  clienteId?: string;
}

interface TelefonoAlternativo {
  numero: string;
  observacion: string;
}

const Modal = ({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-800 text-white p-6 text-left align-middle shadow-xl transition-all">
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

const departamentos = [
  { nombre: "Montevideo", localidades: ["Centro", "Ciudad Vieja", "Pocitos"] },
  {
    nombre: "Canelones",
    localidades: ["Las Piedras", "La Paz", "Barros Blancos"],
  },
  {
    nombre: "Maldonado",
    localidades: ["Punta del Este", "San Carlos", "La Barra"],
  },
  { nombre: "Salto", localidades: ["Salto"] },
];

// Corrige todos los Feature Polygon/MultiPolygon en una FeatureCollection
function fixPolygonCoords(featureCollection: any): any {
  if (!featureCollection || featureCollection.type !== "FeatureCollection")
    return featureCollection;

  // Invertir coordenadas en todos los features
  return {
    ...featureCollection,
    features: featureCollection.features.map((feature: any) => {
      const geom = feature.geometry;
      if (!geom) return feature;

      if (geom.type === "Polygon") {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map((ring: any) =>
              ring.map((coord: [number, number]) => [coord[1], coord[0]]) // invierte [lat, lng] => [lng, lat]
            ),
          },
        };
      }
      if (geom.type === "MultiPolygon") {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map((polygon: any) =>
              polygon.map((ring: any) =>
                ring.map((coord: [number, number]) => [coord[1], coord[0]])
              )
            ),
          },
        };
      }
      return feature;
    }),
  };
}

// Helper para asegurar que los polígonos estén en formato [lng, lat]
function ensurePolygonsLngLat(geojson: any): any {
  if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features))
    return geojson;
  return {
    ...geojson,
    features: geojson.features.map((feature: any) => {
      if (!feature.geometry || !feature.geometry.coordinates) return feature;
      const geom = feature.geometry;
      if (geom.type === "Polygon") {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map((ring: any) =>
              ring.map((coord: any) =>
                Array.isArray(coord) && coord.length === 2
                  ? [
                      typeof coord[0] === "number" && typeof coord[1] === "number"
                        ? Math.abs(coord[0]) > 90
                          ? coord[0]
                          : coord[1]
                        : coord[0],
                      typeof coord[0] === "number" && typeof coord[1] === "number"
                        ? Math.abs(coord[0]) > 90
                          ? coord[1]
                          : coord[0]
                        : coord[1],
                    ]
                  : coord
              )
            ),
          },
        };
      }
      if (geom.type === "MultiPolygon") {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map((polygon: any) =>
              polygon.map((ring: any) =>
                ring.map((coord: any) =>
                  Array.isArray(coord) && coord.length === 2
                    ? [
                        typeof coord[0] === "number" && typeof coord[1] === "number"
                          ? Math.abs(coord[0]) > 90
                            ? coord[0]
                            : coord[1]
                          : coord[0],
                        typeof coord[0] === "number" && typeof coord[1] === "number"
                          ? Math.abs(coord[0]) > 90
                            ? coord[1]
                            : coord[0]
                          : coord[1],
                      ]
                    : coord
                )
              )
            ),
          },
        };
      }
      return feature;
    }),
  };
}

const mockStreets = [
  "Avenida Italia",
  "Avenida Millán",
  "26 de Marzo",
  "Bulevar España",
  "Rambla de Montevideo",
  "Avenida 18 de Julio",
  "Avenida Brasil",
  "Avenida Libertador",
  "Avenida Italia y Bulevar Artigas",
  "Avenida General Flores",
];

function getPuestoActual() {
  if (typeof window === "undefined") return null;
  const actual = localStorage.getItem("puestoActual");
  if (actual) {
    try {
      return JSON.parse(actual);
    } catch {
      return null;
    }
  }
  // fallback: busca el único puesto
  const p = localStorage.getItem("puesto");
  if (p) {
    try {
      return JSON.parse(p);
    } catch {
      return null;
    }
  }
  return null;
}

export default function ClienteForm({ clienteId }: ClienteFormProps) {
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [telefonos, setTelefonos] = useState<TelefonoAlternativo[]>([]);
  const [newTelefono, setNewTelefono] = useState<TelefonoAlternativo>({
    numero: "",
    observacion: "",
  });
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>("");
  const [localidades, setLocalidades] = useState<string[]>([]);
  const [selectedLocalidad, setSelectedLocalidad] = useState<string>("");
  const [direccion, setDireccion] = useState<string>("");
  const [nroPuerta, setNroPuerta] = useState<string>("");
  const [esquina1, setEsquina1] = useState<string>("");
  const [esquina2, setEsquina2] = useState<string>("");
  const [runTour, setRunTour] = useState(false);
  const [capas, setCapas] = useState<any[]>([]);
  const [capasGeoJson, setCapasGeoJson] = useState<any[]>([]);
  const [tab, setTab] = useState("datos");
  const [telefonosRows, setTelefonosRows] = useState<Telefono[]>([]);
  const [direcciones, setDirecciones] = useState<DireccionRow[]>([]);
  const [editingDirId, setEditingDirId] = useState<string | undefined>(undefined);
  const [dirDraft, setDirDraft] = useState<Direccion>({});

  const steps: Step[] = [
    {
      target: ".tour-departamento",
      content: "Selecciona el departamento del cliente.",
      disableBeacon: true,
    },
    {
      target: ".tour-localidad",
      content: "Selecciona la localidad correspondiente.",
    },
    {
      target: ".tour-direccion",
      content: "Ingresa la dirección principal.",
    },
    {
      target: ".tour-nro-puerta",
      content: "Completa el número de puerta.",
    },
    {
      target: ".tour-mapa",
      content:
        "Aquí puedes ubicar al cliente en el mapa y ajustar la ubicación.",
    },
    {
      target: ".tour-latitud",
      content: "Aquí verás la latitud geolocalizada.",
    },
    {
      target: ".tour-longitud",
      content: "Aquí verás la longitud geolocalizada.",
    },
    {
      target: ".tour-telefonos",
      content: "Puedes agregar teléfonos alternativos aquí.",
    },
    {
      target: ".tour-guardar",
      content: "Guarda el cliente una vez completados los datos.",
    },
  ];

  useEffect(() => {
    if (!coords.lat || !coords.lng || capasGeoJson.length === 0) return;

    // Asegurate que el punto sea [lng, lat]
    const pt = turfPoint([parseFloat(coords.lng), parseFloat(coords.lat)]);
    let inZone = false;

    console.log("[ZONA DEBUG] === Comprobando punto:", pt);

    capasGeoJson.forEach((zona, idx) => {
      // Log primer coordenada del polígono
      if (
        zona &&
        zona.features &&
        zona.features.length > 0 &&
        zona.features[0].geometry &&
        zona.features[0].geometry.coordinates &&
        zona.features[0].geometry.coordinates[0] &&
        zona.features[0].geometry.coordinates[0][0]
      ) {
        console.log(
          "[ZONA DEBUG] Primer punto del polígono antes:",
          zona.features[0].geometry.coordinates[0][0]
        ); // [lng, lat]
      }

      if (zona.type === "FeatureCollection" && Array.isArray(zona.features)) {
        zona.features.forEach((feature: any, i: number) => {
          const nombre =
            feature.properties?.name ||
            feature.properties?.id ||
            `[sin nombre]`;
          try {
            const inside = booleanPointInPolygon(pt, feature);
            console.log(
              `[ZONA DEBUG] ¿El punto está en el polígono '${nombre}'? -> ${inside}`,
              { feature }
            );
            if (inside) {
              inZone = true;
              console.log(
                `[ZONA DEBUG] El punto está DENTRO de '${nombre}' (feature #${i} de la zona #${idx})`
              );
            }
          } catch (e) {
            console.warn(
              "[ZONA DEBUG] Error en booleanPointInPolygon (feature)",
              e,
              feature
            );
          }
        });
      }
    });

    // Resultado final
    if (inZone) {
      console.log("[ZONA DEBUG] ✅ El cliente está en zona");
      toast.success("Cliente en zona", {
        duration: Infinity,
        closeButton: true,
      });
    } else {
      console.log("[ZONA DEBUG] ❌ El cliente está fuera de zona");
      toast.error("Cliente fuera de zona", {
        duration: Infinity,
        closeButton: true,
      });
    }
  }, [coords, capasGeoJson]);

  useEffect(() => {
    // Obtener el puesto actual
    const puesto = getPuestoActual();
    if (puesto && puesto.puestoId) {
      apiGetCapaGoya({ PuestoId: String(puesto.puestoId), TipoCapaId: "" })
        .then((data) => {
          const capasArr = data?.sdtCapasGoya || [];
          setCapas(capasArr);
          // Convertir cada capa a GeoJSON válido
          const geojsons = capasArr
            .map((capa: any) => {
              let parsed = null;
              try {
                parsed =
                  typeof capa.CapaGeoJson === "string"
                    ? JSON.parse(capa.CapaGeoJson)
                    : capa.CapaGeoJson;
              } catch {
                parsed = null;
              }
              // Si es FeatureCollection con coords {lng,lat}, convertir a GeoJSON válido
              if (parsed && parsed.type === "FeatureCollection") {
                return GenexusFeatureCollectionToGeoJson(parsed);
              }
              return null;
            })
            .filter(Boolean);
          setCapasGeoJson(geojsons);
        })
        .catch((err) => {
          setCapas([]);
          setCapasGeoJson([]);
          console.error("Error al obtener capas para el puesto:", err);
        });
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      localStorage.setItem("clienteFormTour", "true");
    }
  };

  const handleAdd = () => {
    setTelefonos([...telefonos, newTelefono]);
    setNewTelefono({ numero: "", observacion: "" });
    setShowModal(false);
  };

  const handleEdit = (index: number) => {
    const telefono = telefonos[index];
    setNewTelefono(telefono);
    setShowModal(true);
  };

  const handleDelete = (index: number) => {
    setTelefonos(telefonos.filter((_, i) => i !== index));
  };

  const handleDepartamentoChange = (departamento: string) => {
    setSelectedDepartamento(departamento);
    const depto = departamentos.find((d) => d.nombre === departamento);
    setLocalidades(depto ? depto.localidades : []);
  };

  const handleLocalidadChange = (localidad: string) => {
    setSelectedLocalidad(localidad);
    console.log("Localidad seleccionada:", localidad);
  };

  // Mostrar editor de dirección si:
  // - el usuario presionó "Nueva" o "Editar" en la tabla
  const showDireccionEditor = editingDirId !== undefined;

  const startNewDireccion = () => {
    setEditingDirId("new");
    setDirDraft({ departamento: "", localidad: "", calle: "", nroPuerta: "" });
    // collapse list by switching focus to editor section (list remains above but compact)
  };
  const startEditDireccion = (id?: string) => {
    const row = direcciones.find((d) => (d.id ?? "") === (id ?? ""));
    setEditingDirId(id);
    setDirDraft({
      departamento: "",
      localidad: "",
      calle: row?.calle || "",
      nroPuerta: row?.nro || "",
      esquina1: row?.esquina1 || "",
      esquina2: row?.esquina2 || "",
      nivel: row?.nivel || "",
      local: row?.local || "",
      lat: row?.lat || "",
      lng: row?.lng || "",
    });
  };
  const cancelDireccion = () => {
    setEditingDirId(undefined);
    setDirDraft({});
  };
  const saveDireccion = () => {
    const toRow: DireccionRow = {
      id:
        editingDirId && editingDirId !== "new"
          ? editingDirId
          : crypto.randomUUID(),
      calle: dirDraft.calle,
      nro: dirDraft.nroPuerta,
      esquina1: dirDraft.esquina1,
      esquina2: dirDraft.esquina2,
      nivel: dirDraft.nivel,
      local: dirDraft.local,
      lat: dirDraft.lat,
      lng: dirDraft.lng,
    };
    if (editingDirId && editingDirId !== "new") {
      setDirecciones((prev) =>
        prev.map((d) => (d.id === editingDirId ? toRow : d))
      );
    } else {
      setDirecciones((prev) => [toRow, ...prev]);
    }
    cancelDireccion();
  };
  const deleteDireccion = (id?: string) =>
    setDirecciones((prev) => prev.filter((d) => d.id !== id));

  return (
    <Card>
      <CardHeader className="border-b space-y-3">
        <CardTitle>Cliente</CardTitle>
        <div className="flex items-center justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="datos">Datos</TabsTrigger>
              <TabsTrigger value="telefonos">Teléfonos</TabsTrigger>
              <TabsTrigger value="direcciones">Direcciones</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <span>Cancelar</span>
            </Button>
            <Button className="flex items-center gap-2" onClick={() => setLoading(true)}>
              <span>Guardar Cliente</span>
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-blue-500"></div>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Joyride
         steps={steps}
         run={runTour}
         continuous
         showSkipButton
         showProgress
         styles={{
           options: {
             zIndex: 10000,
             primaryColor: "#2563eb",
             textColor: "#222",
             backgroundColor: "#fff",
           },
         }}
         callback={handleJoyrideCallback}
         locale={{
           last: "Finalizar",
           skip: "Saltar",
           next: "Siguiente",
           back: "Atrás",
         }}
       />
        <Tabs value={tab} onValueChange={setTab}>
           <TabsContent value="datos">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               <CollapsibleCard title="Información Básica" defaultOpen={true}>
                 <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
                   <div className="md:col-span-2">
                     <Label className="text-xs">Teléfono Principal</Label>
                     <Input className="h-8 text-xs" placeholder="46326008" />
                   </div>
                   <div className="md:col-span-2">
                     <Label className="text-xs">Nombre</Label>
                     <Input className="h-8 text-xs" placeholder="DIEGO" />
                   </div>
                   <div className="md:col-span-2">
                     <Label className="text-xs">Apellido</Label>
                     <Input className="h-8 text-xs" placeholder="MEDAGLIA" />
                   </div>
                   <div className="md:col-span-3">
                     <Label className="text-xs">Obs. Cliente</Label>
                     <Input className="h-8 text-xs" placeholder="Observaciones" />
                   </div>
                   <div className="md:col-span-3">
                     <Label className="text-xs">Email</Label>
                     <Input className="h-8 text-xs" placeholder="example@mail.com" />
                   </div>
                   <div className="md:col-span-2">
                     <Label className="text-xs">Tipo Cliente</Label>
                     <Select>
                       <SelectTrigger className="h-8 text-xs"><span>Seleccionar</span></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="domesticos">DOMÉSTICOS</SelectItem>
                         <SelectItem value="empresarial">COMERCIAL</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 </CardContent>
               </CollapsibleCard>

               <Card>
                 <CardHeader>
                   <CardTitle className="text-base">Observaciones</CardTitle>
                 </CardHeader>
                 <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   <div>
                     <Label className="text-xs">Obs. General</Label>
                     <Input className="h-8 text-xs" placeholder="Observaciones varias" />
                   </div>
                   <div>
                     <Label className="text-xs">Obs. Comercial</Label>
                     <Input className="h-8 text-xs" placeholder="Cliente moroso en 2023" />
                   </div>
                 </CardContent>
               </Card>

               <Card>
                 <CardHeader>
                   <CardTitle className="text-base">Información Adicional</CardTitle>
                 </CardHeader>
                 <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
                   <div className="md:col-span-2">
                     <Label className="text-xs">RUT o CI</Label>
                     <Input className="h-8 text-xs" placeholder="0" />
                   </div>
                   <div className="md:col-span-2">
                     <Label className="text-xs">GCI Nº</Label>
                     <Input className="h-8 text-xs" placeholder="GCI Nº" />
                   </div>
                   <div className="md:col-span-2">
                     <Label className="text-xs">Tipo de cliente</Label>
                     <Select>
                       <SelectTrigger className="h-8 text-xs"><span>Seleccionar</span></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="residencial">Residencial</SelectItem>
                         <SelectItem value="comercial">Comercial</SelectItem>
                         <SelectItem value="industrial">Industrial</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   <div className="md:col-span-2">
                     <Label className="text-xs">Privilegio</Label>
                     <Input className="h-8 text-xs" placeholder="Ej: VIP" />
                   </div>
                 </CardContent>
               </Card>

               <Card>
                 <CardHeader>
                   <CardTitle className="text-base">Historial</CardTitle>
                 </CardHeader>
                 <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                   <div>
                     <Label className="text-xs">Fecha Alta</Label>
                     <Input className="h-8 text-xs" value="22/04/2013 00:00" readOnly />
                   </div>
                   <div>
                     <Label className="text-xs">Ult. Modificación</Label>
                     <Input className="h-8 text-xs" value="22/04/2013 00:00" readOnly />
                   </div>
                   <div>
                     <Label className="text-xs">Ult. Compra</Label>
                     <Input className="h-8 text-xs" value="/ / 00:00" readOnly />
                   </div>
                 </CardContent>
               </Card>
             </div>
           </TabsContent>

           <TabsContent value="telefonos">
             <Card>
               <CardHeader>
                 <CardTitle>Teléfonos</CardTitle>
               </CardHeader>
               <CardContent>
                 <TelefonosTable
                   value={telefonosRows}
                   onChange={setTelefonosRows}
                 />
               </CardContent>
             </Card>
           </TabsContent>

           <TabsContent value="direcciones">
             <div className="space-y-2">
               <Card>
                 <CardHeader className="py-2">
                   <div className="flex items-center justify-between">
                     <CardTitle className="text-base">Direcciones</CardTitle>
                     <Button size="sm" variant="outline" onClick={startNewDireccion}>Nueva</Button>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-0 pb-2">
                   {editingDirId === undefined && (
                     <DireccionesTable
                       value={direcciones}
                       onEdit={(id) => startEditDireccion(id)}
                       onDelete={(id) => deleteDireccion(id)}
                       onNew={startNewDireccion}
                     />
                   )}
                 </CardContent>
               </Card>

               {showDireccionEditor && (
                 <DireccionEditor
                  value={dirDraft}
                  onChange={(patch) => setDirDraft((prev) => ({ ...prev, ...patch }))}
                  footer={
                    <>
                      <Button variant="secondary" onClick={cancelDireccion}>Cancelar</Button>
                      <Button onClick={saveDireccion}>Guardar dirección</Button>
                    </>
                  }
                />
               )}
             </div>
           </TabsContent>
         </Tabs>
       </CardContent>
     </Card>
   );
 }
