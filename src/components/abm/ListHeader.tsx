"use client";

import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";

/**
 * Header for ABM list pages.
 *
 * Renders search input + optional "create" button + slot for filter buttons.
 * The `title` prop is OPTIONAL because PageHeader (rendered from page.tsx)
 * already handles the page title — this header sits inside the TableCard.
 * Pass `title` only on legacy/standalone pages without a PageHeader above.
 */
export function ListHeader({
  title,
  search,
  onSearch,
  onCreate,
  createLabel = "Nuevo",
  rightExtra,
}: {
  title?: string;
  search: string;
  onSearch: (v: string) => void;
  onCreate?: () => void;
  createLabel?: string;
  rightExtra?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in-up">
      {title ? (
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      ) : (
        // Spacer to keep flex layout stable when no title is rendered
        <span className="hidden sm:block" aria-hidden="true" />
      )}
      <div
        className="flex gap-2 w-full sm:w-auto justify-end items-center animate-fade-in-left"
        style={{ animationDelay: "0.1s" }}
      >
        {rightExtra}
        <div className="relative sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>
        {onCreate && (
          <Button onClick={onCreate} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            {createLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
