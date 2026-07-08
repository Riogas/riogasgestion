"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/abm/Pager";
import { CompararModal } from "./CompararModal";
import type { MatchSugerencia } from "@/lib/types/persona";
import { ArrowLeftRight, GitMerge, Home, RefreshCw, SearchX } from "lucide-react";

interface SugerenciasTableProps {
  sugerencias: MatchSugerencia[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

function tipoBadge(tipo: MatchSugerencia["tipo"]) {
  if (tipo === "DUPLICADO") {
    return (
      <Badge variant="info" className="gap-1">
        <GitMerge className="size-3" />
        Duplicado
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Home className="size-3" />
      Hogar
    </Badge>
  );
}

function estadoBadge(estado: MatchSugerencia["estado"]) {
  const variant =
    estado === "ACEPTADO" ? "success" : estado === "RECHAZADO" ? "destructive" : "warn";
  const label =
    estado === "ACEPTADO" ? "Aceptado" : estado === "RECHAZADO" ? "Rechazado" : "Pendiente";
  return <Badge variant={variant}>{label}</Badge>;
}

function formatSenal(senal: string) {
  const texto = senal.replace(/_/g, " ").toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function ParCell({ s }: { s: MatchSugerencia }) {
  const esDuplicado = s.tipo === "DUPLICADO";
  const idA = esDuplicado ? s.registroA : s.personaA;
  const idB = esDuplicado ? s.registroB : s.personaB;
  const prefijo = esDuplicado ? "Registro" : "Persona";
  return (
    <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
      <span>
        {prefijo} #{idA ?? "—"}
      </span>
      <ArrowLeftRight className="size-3 shrink-0" />
      <span>
        {prefijo} #{idB ?? "—"}
      </span>
    </div>
  );
}

const SKELETON_COLS = [40, 32, 24, 40, 24, 20];

function SkeletonRow() {
  return (
    <TableRow>
      {SKELETON_COLS.map((w, i) => (
        <TableCell key={i}>
          <div
            className="h-4 rounded bg-muted animate-pulse"
            style={{ width: `${w * 4}px`, maxWidth: "100%" }}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function SugerenciasTable({
  sugerencias,
  total,
  page,
  pageSize,
  isLoading,
  isError,
  onRefetch,
  onPageChange,
  onPageSizeChange,
}: SugerenciasTableProps) {
  const [selected, setSelected] = useState<MatchSugerencia | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const skeletonRows = Array.from({ length: pageSize > 10 ? 10 : pageSize });

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Señal</TableHead>
            <TableHead>Confianza</TableHead>
            <TableHead>Par</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            skeletonRows.map((_, i) => <SkeletonRow key={i} />)}

          {!isLoading && isError && (
            <TableRow>
              <TableCell colSpan={6} className="whitespace-normal">
                <EmptyState
                  icon={RefreshCw}
                  size="sm"
                  title="Error al cargar sugerencias"
                  description="No se pudo conectar con el servidor. Verificá tu conexión."
                  action={
                    <Button variant="outline" size="sm" onClick={onRefetch} className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Reintentar
                    </Button>
                  }
                />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && sugerencias.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="whitespace-normal">
                <EmptyState
                  icon={SearchX}
                  size="sm"
                  title="Sin sugerencias para mostrar"
                  description="No hay sugerencias que coincidan con los filtros aplicados."
                />
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            !isError &&
            sugerencias.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{tipoBadge(s.tipo)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{formatSenal(s.senal)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={Math.round(s.confianza * 100)} className="h-1.5 w-16" />
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {Math.round(s.confianza * 100)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <ParCell s={s} />
                </TableCell>
                <TableCell>{estadoBadge(s.estado)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setSelected(s)}>
                    Revisar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {!isLoading && !isError && sugerencias.length > 0 && (
        <Pager
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onFirst={() => onPageChange(1)}
          onPrev={() => onPageChange(Math.max(1, page - 1))}
          onNext={() => onPageChange(Math.min(totalPages, page + 1))}
          onLast={() => onPageChange(totalPages)}
          onChangePageSize={onPageSizeChange}
        />
      )}

      <CompararModal
        sugerencia={selected}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
