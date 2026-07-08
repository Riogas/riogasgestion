"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableCard } from "@/components/abm/TableCard";
import {
  WorkbenchFilters,
  type WorkbenchFiltersValue,
} from "@/components/clientes/workbench/WorkbenchFilters";
import { SugerenciasTable } from "@/components/clientes/workbench/SugerenciasTable";
import { useSugerencias } from "@/hooks/workbench";
import { RefreshCw } from "lucide-react";

export default function WorkbenchPage() {
  const [filters, setFilters] = useState<WorkbenchFiltersValue>({
    tipo: "",
    estado: "PENDIENTE",
    minConfianza: 0,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const params = useMemo(
    () => ({
      tipo: filters.tipo || undefined,
      estado: filters.estado || undefined,
      minConfianza: filters.minConfianza > 0 ? filters.minConfianza : undefined,
      page,
      pageSize,
    }),
    [filters, page, pageSize],
  );

  const { data, isLoading, isError, refetch, isFetching } = useSugerencias(params);

  const handleFiltersChange = (next: WorkbenchFiltersValue) => {
    setFilters(next);
    setPage(1);
  };

  const handlePageSizeChange = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deduplicación / Workbench"
        description="Revisá sugerencias de duplicados y hogares detectados automáticamente."
      />

      <TableCard
        header={
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <WorkbenchFilters value={filters} onChange={handleFiltersChange} />
            {isFetching && !isLoading && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
            )}
          </div>
        }
      >
        <SugerenciasTable
          sugerencias={data?.data ?? []}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          isLoading={isLoading}
          isError={isError}
          onRefetch={refetch}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </TableCard>
    </div>
  );
}
