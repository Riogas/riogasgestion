"use client";

import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function TableCard({
  header,
  children,
  className,
}: {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn("p-5 animate-fade-in-up", className)}
      style={{ animationDelay: "0.1s" }}
    >
      {header ? <div className="mb-4">{header}</div> : null}
      <div className="rounded-[var(--radius-md)] border border-border/60 overflow-hidden">
        {children}
      </div>
    </Card>
  );
}
