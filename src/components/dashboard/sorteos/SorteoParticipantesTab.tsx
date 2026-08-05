"use client";

import { useMemo } from "react";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  SearchX,
  Smartphone,
  Trophy,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Pager } from "@/components/abm/Pager";
import { TableCard } from "@/components/abm/TableCard";
import { SorteosToolbar } from "./SorteosToolbar";
import { useDescargarCsvParticipaciones, useSorteoParticipaciones } from "@/hooks/sorteos";
import { useDebounce } from "@/hooks/useDebounce";
import { normalizarDepartamento, normalizarPais } from "@/lib/geo-uy";
import type { SorteoDetalle, SorteoParticipacion } from "@/lib/types/sorteo";
import { fmtFechaHora, fmtNumero } from "./helpers";

function DatoDetalle({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right text-xs font-medium text-foreground">
        {value?.trim() ? value : "—"}
      </dd>
    </div>
  );
}

function DetallePopover({ p }: { p: SorteoParticipacion }) {
  const coords = p.gpsLat && p.gpsLng ? `${p.gpsLat}, ${p.gpsLng}` : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <Smartphone className="size-4" />
          Detalle
        </Button>
      </PopoverTrigger>
      {/* Variante SÓLIDA local: el `surface-glass` (78% opaco) del primitivo
          deja leer la tabla de atrás justo donde van Device ID y fingerprint.
          Fondo opaco del token de superficie + borde y sombra plenos. */}
      <PopoverContent
        align="end"
        className="w-80 !bg-popover !border-border shadow-lg"
      >
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ubicación
            </p>
            <dl className="divide-y divide-border/50">
              <DatoDetalle
                label="Departamento"
                value={normalizarDepartamento(p.gpsDepartamento ?? p.ipRegion)}
              />
              <DatoDetalle label="Localidad" value={p.gpsLocalidad ?? p.ipCiudad} />
              <DatoDetalle label="País" value={normalizarPais(p.gpsPais ?? p.ipPais)} />
              <DatoDetalle label="Coordenadas" value={coords} />
              <DatoDetalle label="Fuente" value={p.geoFuente} />
            </dl>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dispositivo
            </p>
            <dl className="divide-y divide-border/50">
              <DatoDetalle label="Plataforma" value={p.plataforma} />
              <DatoDetalle label="Idioma" value={p.idioma} />
              <DatoDetalle label="Resolución" value={p.resolucion} />
              <DatoDetalle label="IP" value={p.ip} />
              <DatoDetalle label="Device ID" value={p.deviceId} />
              <DatoDetalle label="Fingerprint" value={p.fingerprint} />
            </dl>
          </div>
          {p.userAgent && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                User agent
              </p>
              <p className="break-words text-[11px] leading-relaxed text-muted-foreground">
                {p.userAgent}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SorteoParticipantesTab({ sorteo }: { sorteo: SorteoDetalle }) {
  const [searchInput, setSearchInput] = useQueryState("pq", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState("pp", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState("pps", parseAsInteger.withDefault(20));

  const debouncedSearch = useDebounce(searchInput, 400);
  const exportar = useDescargarCsvParticipaciones();

  const params = useMemo(
    () => ({ page, pageSize, search: debouncedSearch || undefined }),
    [page, pageSize, debouncedSearch],
  );

  const { data, isLoading, isError, refetch, isFetching } = useSorteoParticipaciones(
    sorteo.id,
    params,
  );

  const participaciones = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearch = (v: string) => {
    setSearchInput(v);
    setPage(1);
  };

  const handleChangePageSize = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  // El endpoint de export no acepta filtros: siempre baja el sorteo completo.
  // El botón lo dice ("Exportar todo") y por eso se habilita según el total del
  // sorteo, no según lo que quedó en pantalla tras buscar.
  const totalSorteo = sorteo.stats.participaciones;

  const exportarCsv = () => {
    exportar.mutate(sorteo.id, {
      onSuccess: () =>
        toast.success(
          `CSV descargado con las ${fmtNumero(totalSorteo)} participaciones del sorteo`,
        ),
    });
  };

  return (
    <TableCard
      header={
        <SorteosToolbar
          search={searchInput}
          onSearch={handleSearch}
          searchPlaceholder="Buscar por nombre, teléfono o email…"
          searchLabel="Buscar participantes"
          meta={
            <>
              {isFetching && !isLoading && (
                <RefreshCw
                  className="size-4 animate-spin text-muted-foreground"
                  aria-label="Actualizando"
                />
              )}
              <span className="hidden text-xs text-muted-foreground sm:inline tabular-nums">
                {debouncedSearch
                  ? `${fmtNumero(total)} de ${fmtNumero(totalSorteo)} participaciones`
                  : `${fmtNumero(total)} participaciones`}
              </span>
            </>
          }
          actions={
            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={exportarCsv}
                  disabled={exportar.isPending || totalSorteo === 0}
                >
                  {exportar.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="size-4" />
                  )}
                  {exportar.isPending ? "Generando CSV…" : "Exportar todo (CSV)"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Baja las {fmtNumero(totalSorteo)} participaciones del sorteo, sin el
                filtro de búsqueda.
              </TooltipContent>
            </Tooltip>
          }
        />
      }
    >
      {isLoading && (
        <div className="space-y-2 p-4">
          {Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-[var(--radius-md)] bg-muted" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <EmptyState
          icon={RefreshCw}
          title="No se pudieron cargar las participaciones"
          description="Verificá tu conexión y reintentá."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="size-4" />
              Reintentar
            </Button>
          }
        />
      )}

      {!isLoading && !isError && participaciones.length === 0 && (
        <EmptyState
          icon={debouncedSearch ? SearchX : Users}
          title={debouncedSearch ? "Sin resultados" : "Todavía no hay participantes"}
          description={
            debouncedSearch
              ? `No encontramos participantes que coincidan con "${debouncedSearch}".`
              : "Cuando alguien escanee un QR y complete el formulario, va a aparecer acá."
          }
          action={
            debouncedSearch ? (
              <Button variant="outline" onClick={() => handleSearch("")}>
                Limpiar búsqueda
              </Button>
            ) : undefined
          }
        />
      )}

      {!isLoading && !isError && participaciones.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-40 px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="w-36 px-4 py-3 font-medium">Teléfono</th>
                  <th className="w-20 px-4 py-3 text-right font-medium">Edad</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="w-28 px-4 py-3 font-medium">Resultado</th>
                  {/* Mismo criterio que la tab Ganadores: la celda es un botón
                      ("Detalle"), así que el header dice Acciones, no Origen. */}
                  <th className="w-32 px-2 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {participaciones.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {fmtFechaHora(p.createdAt)}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 font-medium text-foreground">
                      {p.nombre}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">{p.telefono}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {p.edad}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                      {p.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.ganador ? (
                        <Badge variant="success">
                          <Trophy className="size-3" />
                          Ganador
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin premio</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <DetallePopover p={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pager
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onFirst={() => setPage(1)}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            onLast={() => setPage(totalPages)}
            onChangePageSize={handleChangePageSize}
          />
        </>
      )}
    </TableCard>
  );
}
