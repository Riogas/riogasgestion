"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDeleteCliente } from "@/hooks/clientes";
import { EstadoCliente, TipoCliente, type Cliente } from "@/lib/types/cliente";
import {
  MoreHorizontal,
  Plus,
  UserX,
  MapPin,
  Home,
} from "lucide-react";
import { toast } from "sonner";

interface ClienteHeaderProps {
  cliente: Cliente;
}

function estadoBadgeVariant(estado: EstadoCliente) {
  switch (estado) {
    case EstadoCliente.ACTIVO:
      return "success" as const;
    case EstadoCliente.INACTIVO:
      return "destructive" as const;
    case EstadoCliente.PENDIENTE:
      return "warn" as const;
    default:
      return "secondary" as const;
  }
}

function getInitials(nombre: string, apellido: string | null) {
  const a = nombre.trim()[0] ?? "";
  const b = (apellido ?? "").trim()[0] ?? "";
  return (a + b).toUpperCase() || "??";
}

export function ClienteHeader({ cliente }: ClienteHeaderProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { mutate: deleteCliente, isPending: isDeleting } = useDeleteCliente();

  const initials = getInitials(cliente.nombre, cliente.apellido);
  const nombreCompleto = [cliente.nombre, cliente.apellido].filter(Boolean).join(" ");

  const dirPrincipal = cliente.direcciones.find((d) => d.esPrincipal) ?? cliente.direcciones[0];
  const zonaPrincipal = dirPrincipal?.zona ?? null;

  const handleBaja = () => {
    deleteCliente(cliente.id, {
      onSuccess: () => {
        toast.success(`Cliente "${nombreCompleto}" dado de baja.`);
        setConfirmOpen(false);
        router.push("/dashboard/clientes");
      },
      onError: () => {
        toast.error("Error al dar de baja el cliente. Intentá de nuevo.");
      },
    });
  };

  return (
    <>
      {/* Sticky header */}
      <header className="sticky top-16 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="px-4 py-3 flex items-center gap-4">
          {/* Avatar */}
          <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-base">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Name + ID */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-foreground truncate">
                {nombreCompleto}
              </h1>
              {cliente.nroCliente != null && (
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  #{cliente.nroCliente}
                </span>
              )}
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant={estadoBadgeVariant(cliente.estado)}>
                {cliente.estado}
              </Badge>

              {zonaPrincipal && (
                <Badge variant="info" className="gap-1">
                  <MapPin className="size-3" />
                  {zonaPrincipal}
                </Badge>
              )}

              <Badge variant="secondary" className="gap-1">
                <Home className="size-3" />
                {cliente.tipoCliente === TipoCliente.DOMESTICO ? "Doméstico" : "Comercial"}
              </Badge>

              {cliente.categoria && (
                <Badge variant="outline">{cliente.categoria}</Badge>
              )}
            </div>
          </div>

          {/* KPIs inline */}
          <div className="hidden md:flex items-center gap-6 shrink-0">
            <KpiItem
              label="Saldo"
              value="—"
              title="Próximamente — módulo de cuenta"
            />
            <KpiItem
              label="Último pedido"
              value="—"
              title="Próximamente — módulo de pedidos"
            />
            <KpiItem
              label="Direcciones"
              value={String(cliente.direcciones.length)}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled size="sm" className="gap-1.5">
                    <Plus className="size-4" />
                    <span className="hidden sm:inline">Pedido</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Próximamente — módulo de pedidos</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Más acciones">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive gap-2"
                  onSelect={() => setConfirmOpen(true)}
                >
                  <UserX className="size-4" />
                  Dar de baja
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar baja del cliente</DialogTitle>
            <DialogDescription>
              El cliente <strong>{nombreCompleto}</strong> pasará a estado INACTIVO. Esta
              acción se puede revertir editando el campo de estado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBaja}
              disabled={isDeleting}
            >
              {isDeleting ? "Dando de baja…" : "Confirmar baja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KpiItem({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="text-center" title={title}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
