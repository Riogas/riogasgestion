"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Chart body — typically a recharts component (AreaChart, BarChart, etc.) */
  children: ReactNode;
  /** Chart container height in px. Default 280. */
  height?: number;
  /** Card variant — default | glass | hero. Default 'default'. */
  variant?: "default" | "glass" | "hero";
  className?: string;
  /** If true, omits the ResponsiveContainer wrapper (use for custom layouts). */
  raw?: boolean;
  /** Empty-state node — shown when children is null/undefined */
  emptyState?: ReactNode;
}

/**
 * Standardized chart container — used by every chart in the dashboard for
 * visual consistency. Wraps a recharts component in a Card with title,
 * optional description, optional actions, and a ResponsiveContainer.
 *
 * Usage:
 *   <ChartCard title="Usuarios activos" description="Últimos 7 días">
 *     <AreaChart data={data}> ... </AreaChart>
 *   </ChartCard>
 */
export function ChartCard({
  title,
  description,
  actions,
  children,
  height = 280,
  variant = "default",
  className,
  raw = false,
  emptyState,
}: ChartCardProps) {
  const isEmpty = children == null || children === false;

  return (
    <Card variant={variant} className={cn("card-hover-lift", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-1">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent style={{ height }} className="pt-0">
        {isEmpty ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
            {emptyState ?? (
              <>
                <div className="text-3xl opacity-30">📊</div>
                <p className="text-xs">Sin datos en este rango</p>
              </>
            )}
          </div>
        ) : raw ? (
          children
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
