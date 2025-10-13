"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface NuevoPuestoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (descripcion: string, estado: string) => void;
  initialData?: any;
}

export default function NuevoPuestoModal({
  isOpen,
  onClose,
  onConfirm,
  initialData,
}: NuevoPuestoModalProps) {
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState("A");
  const [loading, setLoading] = useState(false);

  // Campos adicionales solicitados
  const [puestoId, setPuestoId] = useState<string>("");
  const [puestoDir, setPuestoDir] = useState<string>("");
  const [puestoTelUltLin, setPuestoTelUltLin] = useState<string>("");
  const [puestoCallesId, setPuestoCallesId] = useState<string>("");
  const [puestoFleteCobra, setPuestoFleteCobra] = useState<boolean>(false);
  const [puestoFleteCantidad, setPuestoFleteCantidad] = useState<string>("");
  const [puestoGPSEFletera, setPuestoGPSEFletera] = useState<string>("");
  const [puestoUbicacion, setPuestoUbicacion] = useState<string>("");
  const [puestoAtraso, setPuestoAtraso] = useState<string>("");
  const [puestoAutoPedido, setPuestoAutoPedido] = useState<boolean>(false);
  const [puestoFuerzaAutopedido, setPuestoFuerzaAutopedido] = useState<boolean>(false);
  const [puestoPalabraAutopedido, setPuestoPalabraAutopedido] = useState<string>("");
  const [puestoWappActivo, setPuestoWappActivo] = useState<boolean>(false);
  const [puestoAceptaAgendar, setPuestoAceptaAgendar] = useState<boolean>(false);
  const [puestoHorarios, setPuestoHorarios] = useState<string>("");
  const [puestosCoordX, setPuestosCoordX] = useState<string>("");
  const [puestosCoordY, setPuestosCoordY] = useState<string>("");
  const [puestosUltMod, setPuestosUltMod] = useState<string>("");
  const [puestoGCINro, setPuestoGCINro] = useState<string>("");
  const [puestoPruebas, setPuestoPruebas] = useState<boolean>(false);

  const toBool = (v: any) => v === true || v === 1 || v === "1" || v === "S" || v === "A";

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setPuestoId(String(initialData.puestoId ?? initialData.PuestoId ?? ""));
      setDescripcion(String(initialData.puestoDsc ?? initialData.PuestoDsc ?? ""));
      setEstado(String(initialData.puestoEstado ?? initialData.PuestoEstado ?? "A"));
      setPuestoDir(String(initialData.puestoDir ?? initialData.PuestoDir ?? ""));
      setPuestoTelUltLin(String(initialData.puestoTelUltLin ?? initialData.PuestoTelUltLin ?? ""));
      setPuestoCallesId(String(initialData.puestoCallesId ?? initialData.PuestoCallesId ?? ""));
      setPuestoFleteCobra(toBool(initialData.puestoFleteCobra ?? initialData.PuestoFleteCobra));
      setPuestoFleteCantidad(String(initialData.puestoFleteCantidad ?? initialData.PuestoFleteCantidad ?? ""));
      setPuestoGPSEFletera(String(initialData.puestoGPSEFletera ?? initialData.PuestoGPSEFletera ?? ""));
      setPuestoUbicacion(String(initialData.puestoUbicacion ?? initialData.PuestoUbicacion ?? ""));
      setPuestoAtraso(String(initialData.puestoAtraso ?? initialData.PuestoAtraso ?? ""));
      setPuestoAutoPedido(toBool(initialData.puestoAutoPedido ?? initialData.PuestoAutoPedido));
      setPuestoFuerzaAutopedido(toBool(initialData.puestoFuerzaAutopedido ?? initialData.PuestoFuerzaAutopedido));
      setPuestoPalabraAutopedido(String(initialData.puestoPalabraAutopedido ?? initialData.PuestoPalabraAutopedido ?? ""));
      setPuestoWappActivo(toBool(initialData.puestoWappActivo ?? initialData.PuestoWappActivo));
      setPuestoAceptaAgendar(toBool(initialData.puestoAceptaAgendar ?? initialData.PuestoAceptaAgendar));
      setPuestoHorarios(String(initialData.puestoHorarios ?? initialData.PuestoHorarios ?? ""));
      setPuestosCoordX(String(initialData.puestosCoordX ?? initialData.PuestosCoordX ?? ""));
      setPuestosCoordY(String(initialData.puestosCoordY ?? initialData.PuestosCoordY ?? ""));
      setPuestosUltMod(String(initialData.puestosUltMod ?? initialData.PuestosUltMod ?? ""));
      setPuestoGCINro(String(initialData.puestoGCINro ?? initialData.PuestoGCINro ?? ""));
      setPuestoPruebas(toBool(initialData.puestoPruebas ?? initialData.PuestoPruebas));
    } else {
      // reset defaults for nuevo
      setPuestoId("");
      setDescripcion("");
      setEstado("A");
      setPuestoDir("");
      setPuestoTelUltLin("");
      setPuestoCallesId("");
      setPuestoFleteCobra(false);
      setPuestoFleteCantidad("");
      setPuestoGPSEFletera("");
      setPuestoUbicacion("");
      setPuestoAtraso("");
      setPuestoAutoPedido(false);
      setPuestoFuerzaAutopedido(false);
      setPuestoPalabraAutopedido("");
      setPuestoWappActivo(false);
      setPuestoAceptaAgendar(false);
      setPuestoHorarios("");
      setPuestosCoordX("");
      setPuestosCoordY("");
      setPuestosUltMod("");
      setPuestoGCINro("");
      setPuestoPruebas(false);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!descripcion.trim()) {
      toast.error("La descripción del puesto es requerida");
      return;
    }

    try {
      setLoading(true);
      // Nota: por ahora sólo se envía lo que soporta el backend
      await onConfirm(descripcion.trim(), estado);
      // Resetear formulario
      setDescripcion("");
      setEstado("A");
      setPuestoId("");
      setPuestoDir("");
      setPuestoTelUltLin("");
      setPuestoCallesId("");
      setPuestoFleteCobra(false);
      setPuestoFleteCantidad("");
      setPuestoGPSEFletera("");
      setPuestoUbicacion("");
      setPuestoAtraso("");
      setPuestoAutoPedido(false);
      setPuestoFuerzaAutopedido(false);
      setPuestoPalabraAutopedido("");
      setPuestoWappActivo(false);
      setPuestoAceptaAgendar(false);
      setPuestoHorarios("");
      setPuestosCoordX("");
      setPuestosCoordY("");
      setPuestosUltMod("");
      setPuestoGCINro("");
      setPuestoPruebas(false);
      onClose();
    } catch (error) {
      console.error("Error al crear puesto:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Resetear formulario al cancelar
    setDescripcion("");
    setEstado("A");
    setPuestoId("");
    setPuestoDir("");
    setPuestoTelUltLin("");
    setPuestoCallesId("");
    setPuestoFleteCobra(false);
    setPuestoFleteCantidad("");
    setPuestoGPSEFletera("");
    setPuestoUbicacion("");
    setPuestoAtraso("");
    setPuestoAutoPedido(false);
    setPuestoFuerzaAutopedido(false);
    setPuestoPalabraAutopedido("");
    setPuestoWappActivo(false);
    setPuestoAceptaAgendar(false);
    setPuestoHorarios("");
    setPuestosCoordX("");
    setPuestosCoordY("");
    setPuestosUltMod("");
    setPuestoGCINro("");
    setPuestoPruebas(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[1000px] max-h-[85vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-500 ease-out shadow-2xl">
        <DialogHeader className="animate-in slide-in-from-top-2 duration-700 delay-100">
          <DialogTitle className="animate-in zoom-in-50 duration-500 delay-200">
            {initialData ? "Editar Puesto" : "Nuevo Puesto"}
          </DialogTitle>
          <DialogDescription className="animate-in fade-in duration-600 delay-300">
            {initialData ? "Modifique los datos del puesto seleccionado." : "Crear un nuevo puesto de trabajo en el sistema."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 py-4 animate-in slide-in-from-left-4 duration-600 delay-400">
            {/* PuestoId */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoId" className="text-right">Identificador</Label>
              <Input 
                id="puestoId" 
                type="number" 
                value={puestoId} 
                onChange={(e) => setPuestoId(e.target.value)} 
                className="col-span-3 bg-muted/50" 
                placeholder="Generado automáticamente" 
                disabled={true}
              />
            </div>
            {/* Descripción */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="descripcion" className="text-right">Descripción</Label>
              <Input id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="col-span-3 transition-all duration-200 focus:scale-105" placeholder="Ingrese la descripción del puesto" disabled={loading} />
            </div>
            {/* Dirección */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoDir" className="text-right">Dirección</Label>
              <Input id="puestoDir" value={puestoDir} onChange={(e) => setPuestoDir(e.target.value)} className="col-span-3" placeholder="Dirección" disabled={loading} />
            </div>
            {/* Estado */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="estado" className="text-right">Estado</Label>
              <Select value={estado} onValueChange={setEstado} disabled={loading}>
                <SelectTrigger className="col-span-3 transition-all duration-200 focus:scale-105">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Activo</SelectItem>
                  <SelectItem value="P">Pasivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Teléfono */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoTelUltLin" className="text-right">Teléfono</Label>
              <Input id="puestoTelUltLin" type="tel" value={puestoTelUltLin} onChange={(e) => setPuestoTelUltLin(e.target.value)} className="col-span-3" placeholder="Teléfono" disabled={loading} />
            </div>
            {/* Flete Cobra */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoFleteCobra" className="text-right">Flete Cobra</Label>
              <div className="col-span-3">
                <Switch id="puestoFleteCobra" checked={puestoFleteCobra} onCheckedChange={(v) => setPuestoFleteCobra(!!v)} disabled={loading} />
              </div>
            </div>
            {/* Flete Cantidad */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoFleteCantidad" className="text-right">Flete Cantidad</Label>
              <Input id="puestoFleteCantidad" type="number" value={puestoFleteCantidad} onChange={(e) => setPuestoFleteCantidad(e.target.value)} className="col-span-3" placeholder="Cantidad de flete" disabled={loading} />
            </div>
            {/* GPS/E-Fletera */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoGPSEFletera" className="text-right">GPS/E-Fletera</Label>
              <Input id="puestoGPSEFletera" value={puestoGPSEFletera} onChange={(e) => setPuestoGPSEFletera(e.target.value)} className="col-span-3" placeholder="GPS/E-Fletera" disabled={loading} />
            </div>
            {/* Ubicación */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoUbicacion" className="text-right">Ubicación</Label>
              <Input id="puestoUbicacion" value={puestoUbicacion} onChange={(e) => setPuestoUbicacion(e.target.value)} className="col-span-3" placeholder="Ubicación" disabled={loading} />
            </div>
            {/* Atraso */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoAtraso" className="text-right">Atraso</Label>
              <Input id="puestoAtraso" type="number" value={puestoAtraso} onChange={(e) => setPuestoAtraso(e.target.value)} className="col-span-3" placeholder="Minutos de atraso" disabled={loading} />
            </div>
            {/* Auto Pedido */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoAutoPedido" className="text-right">Auto Pedido</Label>
              <div className="col-span-3">
                <Switch id="puestoAutoPedido" checked={puestoAutoPedido} onCheckedChange={(v) => setPuestoAutoPedido(!!v)} disabled={loading} />
              </div>
            </div>
            {/* Fuerza Auto Pedido */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoFuerzaAutopedido" className="text-right">Fuerza Auto Pedido</Label>
              <div className="col-span-3">
                <Switch id="puestoFuerzaAutopedido" checked={puestoFuerzaAutopedido} onCheckedChange={(v) => setPuestoFuerzaAutopedido(!!v)} disabled={loading} />
              </div>
            </div>
            {/* Palabra Clave */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoPalabraAutopedido" className="text-right">Palabra Clave</Label>
              <Input id="puestoPalabraAutopedido" value={puestoPalabraAutopedido} onChange={(e) => setPuestoPalabraAutopedido(e.target.value)} className="col-span-3" placeholder="Palabra clave" disabled={loading} />
            </div>
            {/* Wapp Activo */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoWappActivo" className="text-right">Wapp Activo</Label>
              <div className="col-span-3">
                <Switch id="puestoWappActivo" checked={puestoWappActivo} onCheckedChange={(v) => setPuestoWappActivo(!!v)} disabled={loading} />
              </div>
            </div>
            {/* Acepta Agendar */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoAceptaAgendar" className="text-right">Acepta Agendar</Label>
              <div className="col-span-3">
                <Switch id="puestoAceptaAgendar" checked={puestoAceptaAgendar} onCheckedChange={(v) => setPuestoAceptaAgendar(!!v)} disabled={loading} />
              </div>
            </div>
            {/* PuestosCoordX */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestosCoordX" className="text-right">Coord X (longitud)</Label>
              <Input id="puestosCoordX" type="number" value={puestosCoordX} onChange={(e) => setPuestosCoordX(e.target.value)} className="col-span-3" placeholder="Coord X (longitud)" disabled={loading} />
            </div>
            {/* PuestosCoordY */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestosCoordY" className="text-right">Coord Y (latitud)</Label>
              <Input id="puestosCoordY" type="number" value={puestosCoordY} onChange={(e) => setPuestosCoordY(e.target.value)} className="col-span-3" placeholder="Coord Y (latitud)" disabled={loading} />
            </div>
            {/* PuestosUltMod */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestosUltMod" className="text-right">Ult. Modificación</Label>
              <Input id="puestosUltMod" type="datetime-local" value={puestosUltMod} onChange={(e) => setPuestosUltMod(e.target.value)} className="col-span-3" disabled={loading} />
            </div>
            {/* PuestoGCINro */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoGCINro" className="text-right">GCI Nº</Label>
              <Input id="puestoGCINro" value={puestoGCINro} onChange={(e) => setPuestoGCINro(e.target.value)} className="col-span-3" placeholder="Número GCI" disabled={loading} />
            </div>
            {/* PuestoHorarios */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="puestoHorarios" className="text-right">Horarios</Label>
              <textarea 
                id="puestoHorarios" 
                value={puestoHorarios} 
                onChange={(e) => setPuestoHorarios(e.target.value)} 
                className="col-span-3 min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y" 
                placeholder="Detalle de horarios" 
                disabled={loading} 
              />
            </div>
          </div>
          
          <DialogFooter className="animate-in slide-in-from-bottom-4 duration-600 delay-500">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={loading} className="transition-all duration-200 hover:scale-105">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="transition-all duration-200 hover:scale-105">
              {loading ? (initialData ? "Guardando..." : "Creando...") : (initialData ? "Guardar" : "Crear")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
