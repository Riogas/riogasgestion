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
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 px-4 py-3 border-t border-border/60 text-sm bg-muted/30 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
          Por página
        </span>
        <Select value={String(pageSize)} onValueChange={(v) => onChangePageSize(Number(v))}>
          <SelectTrigger className="w-[72px] h-8" data-size="sm">
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

      <div className="flex-1 text-center text-muted-foreground order-3 sm:order-none w-full sm:w-auto tabular-nums">
        Página <span className="font-semibold text-foreground">{page}</span> de{" "}
        <span className="font-semibold text-foreground">{totalPages}</span>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFirst} disabled={page === 1} aria-label="Primera página">
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev} disabled={page === 1} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext} disabled={page === totalPages} aria-label="Página siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onLast} disabled={page === totalPages} aria-label="Última página">
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
