"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";

export function Pager({
  page,
  totalPages,
  pageSize,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onChangePageSize,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onChangePageSize: (n: number) => void;
}) {
  const base =
    "h-8 w-8 size-8 bg-white text-foreground dark:text-gray-900 border border-border shadow-sm hover:bg-white/90 disabled:opacity-50 disabled:pointer-events-none transition";

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 px-4 py-3 border-t text-sm bg-background/40">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <span className="text-muted-foreground">Registros por página</span>
        <Select value={String(pageSize)} onValueChange={(v) => onChangePageSize(Number(v))}>
          <SelectTrigger className="w-[70px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[5, 10, 20, 50].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 text-center text-muted-foreground order-3 sm:order-none w-full sm:w-auto">
        Página {page} de {totalPages}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button variant="ghost" size="icon" className={base} onClick={onFirst} disabled={page === 1}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className={base} onClick={onPrev} disabled={page === 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className={base} onClick={onNext} disabled={page === totalPages}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className={base} onClick={onLast} disabled={page === totalPages}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
