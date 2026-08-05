"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Info, Loader2, Package, Plus, QrCode, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCrearLote, useDescargarZipLote, useSorteoLotes } from "@/hooks/sorteos";
import { estadoSorteoBadge, type SorteoDetalle } from "@/lib/types/sorteo";
import { fmtFechaHora, fmtNumero, porcentaje } from "./helpers";

const MAX_POR_LOTE = 10000;

function validarCantidad(valor: string): string | null {
  const v = valor.trim();
  if (!v) return "Indicá cuántos códigos generar";
  if (!/^\d+$/.test(v)) return "Ingresá solo números enteros";
  const n = Number(v);
  if (n < 1) return "Tiene que ser al menos 1 código";
  if (n > MAX_POR_LOTE) return `El máximo por lote es ${fmtNumero(MAX_POR_LOTE)} códigos`;
  return null;
}

export function SorteoCodigosTab({ sorteo }: { sorteo: SorteoDetalle }) {
  const { data, isLoading, isError, refetch } = useSorteoLotes(sorteo.id);
  const crearLote = useCrearLote();
  const descargarZip = useDescargarZipLote();

  const lotes = data ?? [];

  // Mismo criterio que la pestaña Configuración: un sorteo cerrado no acepta
  // más escrituras. Códigos generados acá no se podrían usar nunca.
  const soloLectura = sorteo.estado === "finalizado" || sorteo.estado === "cancelado";
  const estadoLabel = estadoSorteoBadge(sorteo.estado).label.toLowerCase();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [cantidad, setCantidad] = useState("100");
  const [tocado, setTocado] = useState(false);

  const error = validarCantidad(cantidad);
  const loteDescargando = descargarZip.isPending ? descargarZip.variables?.loteId : undefined;

  const abrirDialog = () => {
    setCantidad("100");
    setTocado(false);
    setDialogOpen(true);
  };

  const generar = () => {
    setTocado(true);
    if (error) return;
    crearLote.mutate(
      { sorteoId: sorteo.id, cantidad: Number(cantidad) },
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  const descargar = (loteId: number) => {
    descargarZip.mutate(
      { sorteoId: sorteo.id, loteId },
      { onSuccess: () => toast.success(`ZIP del lote #${loteId} descargado`) },
    );
  };

  const disponibles = Math.max(0, sorteo.stats.codigosTotal - sorteo.stats.codigosUsados);

  return (
    <div className="space-y-5">
      <Alert variant="info">
        <Info />
        <AlertTitle>La descarga del ZIP se arma en el momento</AlertTitle>
        <AlertDescription>
          Cada código se renderiza como QR en PNG de alta resolución. Un lote de{" "}
          {fmtNumero(MAX_POR_LOTE)} códigos puede tardar varios minutos y pesar cientos de MB:
          dejá la pestaña abierta hasta que el navegador confirme la descarga.
        </AlertDescription>
      </Alert>

      <Card className="animate-fade-in-up">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Lotes de códigos</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtNumero(sorteo.stats.codigosTotal)} generados ·{" "}
                {fmtNumero(sorteo.stats.codigosUsados)} usados · {fmtNumero(disponibles)}{" "}
                disponibles
              </p>
            </div>
            {soloLectura ? (
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="shrink-0">
                    <Button disabled className="pointer-events-none w-full">
                      <Plus className="size-4" />
                      Generar lote
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  El sorteo está {estadoLabel}: los códigos nuevos no se podrían usar.
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button onClick={abrirDialog} className="shrink-0">
                <Plus className="size-4" />
                Generar lote
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-[var(--radius-md)] bg-muted" />
              ))}
            </div>
          )}

          {isError && !isLoading && (
            <EmptyState
              icon={RefreshCw}
              size="sm"
              title="No se pudieron cargar los lotes"
              description="Verificá tu conexión y reintentá."
              action={
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="size-4" />
                  Reintentar
                </Button>
              }
            />
          )}

          {!isLoading && !isError && lotes.length === 0 && (
            <EmptyState
              icon={QrCode}
              title={soloLectura ? "Este sorteo no llegó a tener lotes" : "Todavía no hay lotes"}
              description={
                soloLectura
                  ? `El sorteo está ${estadoLabel}: ya no se pueden generar códigos nuevos.`
                  : "Generá un lote para imprimir los QR y repartirlos en los puntos de venta."
              }
              action={
                soloLectura ? undefined : (
                  <Button onClick={abrirDialog}>
                    <Plus className="size-4" />
                    Generar lote
                  </Button>
                )
              }
            />
          )}

          {!isLoading && !isError && lotes.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Lote</TableHead>
                  <TableHead className="w-44">Generado</TableHead>
                  <TableHead className="w-28 text-right">Códigos</TableHead>
                  <TableHead className="w-56">Usados</TableHead>
                  <TableHead>Generado por</TableHead>
                  <TableHead className="w-40 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map((lote) => {
                  const pct = porcentaje(lote.codigosUsados, lote.codigosTotal);
                  const descargando = loteDescargando === lote.id;

                  return (
                    <TableRow key={lote.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{lote.id}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {fmtFechaHora(lote.createdAt)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmtNumero(lote.codigosTotal)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
                            <span className="font-medium text-foreground">
                              {fmtNumero(lote.codigosUsados)}
                            </span>
                            <span className="text-muted-foreground">{pct}%</span>
                          </div>
                          <Progress
                            value={pct}
                            aria-label={`Códigos usados del lote ${lote.id}: ${pct}%`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {lote.generadoPor || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => descargar(lote.id)}
                          disabled={descargarZip.isPending}
                        >
                          {descargando ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Download className="size-4" />
                          )}
                          {descargando ? "Generando ZIP…" : "Descargar ZIP"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => !crearLote.isPending && setDialogOpen(v)}
      >
        {/* `!bg-card`: fondo sólido, mismo criterio que los otros diálogos del módulo. */}
        <DialogContent className="sm:max-w-md lg:max-w-md xl:max-w-md !bg-card !border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-primary" />
              Generar lote de códigos
            </DialogTitle>
            <DialogDescription>
              Los códigos se crean en un solo lote y quedan listos para descargar como QR.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="lote-cantidad">
              Cantidad de códigos <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lote-cantidad"
              type="number"
              min={1}
              max={MAX_POR_LOTE}
              inputMode="numeric"
              className="tabular-nums"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onBlur={() => setTocado(true)}
              aria-invalid={tocado && !!error}
              disabled={crearLote.isPending}
            />
            {tocado && error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Máximo {fmtNumero(MAX_POR_LOTE)} códigos por lote.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={crearLote.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={generar} disabled={crearLote.isPending || (tocado && !!error)}>
              {crearLote.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {crearLote.isPending ? "Generando…" : "Generar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
