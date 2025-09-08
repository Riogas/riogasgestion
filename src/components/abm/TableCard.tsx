"use client";

import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function TableCard({
  header,
  children,
}: {
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-6 mt-4">
      {header ? <div className="mb-4">{header}</div> : null}
      <div className="rounded-md border border-border/40 overflow-hidden">
        {children}
      </div>
    </Card>
  );
}
