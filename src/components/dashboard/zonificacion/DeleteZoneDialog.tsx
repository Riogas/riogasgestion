"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Zone } from "@/lib/types/zona";

interface DeleteZoneDialogProps {
  zone: Zone | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteZoneDialog({
  zone,
  deleting,
  onCancel,
  onConfirm,
}: DeleteZoneDialogProps) {
  return (
    <Dialog open={!!zone} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Eliminar zona?</DialogTitle>
          <DialogDescription>
            Esta acción quitará la zona{" "}
            <span className="font-medium text-foreground">{zone?.name}</span>{" "}
            del mapa y no se podrá deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
          >
            <Trash2 className="size-4" />
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
