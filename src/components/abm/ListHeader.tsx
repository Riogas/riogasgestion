"use client";

import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ListHeader({
  title,
  search,
  onSearch,
  onCreate,
  createLabel = "Nuevo",
  rightExtra,
}: {
  title: string;
  search: string;
  onSearch: (v: string) => void;
  onCreate?: () => void;
  createLabel?: string;
  rightExtra?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 animate-fade-in-up">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex gap-2 w-full sm:w-auto justify-end items-center animate-fade-in-left" style={{ animationDelay: '0.1s' }}>
        {rightExtra}
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar..."
          className="sm:w-80 transition-all duration-200 focus:scale-[1.01] focus:shadow-md"
        />
        {onCreate && (
          <Button onClick={onCreate} className="transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95">
            {createLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
