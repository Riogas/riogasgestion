import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageStatItem {
  /** Stable id for React keys. */
  id: string;
  /** Compact label, e.g. "Pendientes". */
  label: string;
  /** Current value as a string ("12", "1,234", "12.4k"). */
  value: string;
  /** Optional unit suffix (e.g. "kg"). Rendered smaller. */
  unit?: string;
  /** Optional lucide icon component (rendered in a small tinted square). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional trend percentage (+/-). Renders a Badge with arrow. */
  trendPct?: number;
  /** Label for the trend (e.g. "vs. ayer"). */
  trendLabel?: string;
  /** Visual emphasis. Default 'default'. */
  variant?: "default" | "primary" | "success" | "warn" | "destructive";
}

interface PageStatsProps {
  items: PageStatItem[];
  className?: string;
}

const VARIANT_ICON_CLASS: Record<NonNullable<PageStatItem["variant"]>, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warn: "bg-warn/10 text-warn",
  destructive: "bg-destructive/10 text-destructive",
};

/**
 * Compact stats row used at the top of index pages (Pattern B from the
 * Goya redesign spec). Renders a responsive grid of small KPI cards
 * with optional icon + trend badge.
 *
 * Usage:
 *   <PageStats items={[
 *     { id: "total", label: "Total pedidos", value: "68", icon: Package },
 *     { id: "pend",  label: "Pendientes",   value: "12", variant: "warn" },
 *   ]} />
 */
export function PageStats({ items, className }: PageStatsProps) {
  if (items.length === 0) return null;
  return (
    <div
      className={cn(
        "grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mb-5",
        className,
      )}
    >
      {items.map((it, i) => (
        <StatCard key={it.id} item={it} index={i} />
      ))}
    </div>
  );
}

function StatCard({ item, index }: { item: PageStatItem; index: number }) {
  const variant = item.variant ?? "default";
  const Icon = item.icon;
  const hasTrend = typeof item.trendPct === "number";
  const positive = (item.trendPct ?? 0) >= 0;
  const TrendIcon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <Card
      className="card-hover-lift animate-fade-in-up"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
            {item.label}
          </span>
          {Icon && (
            <span
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] shrink-0",
                VARIANT_ICON_CLASS[variant],
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1 tabular-nums">
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {item.value}
          </span>
          {item.unit && (
            <span className="text-xs text-muted-foreground font-medium">
              {item.unit}
            </span>
          )}
        </div>
        {hasTrend && (
          <div className="mt-2 flex items-center gap-1.5">
            <Badge
              variant={positive ? "success" : "destructive"}
              className="gap-0.5 text-[10px] px-1.5 py-0"
            >
              <TrendIcon className="h-2.5 w-2.5" />
              {positive ? "+" : ""}
              {item.trendPct!.toFixed(1)}%
            </Badge>
            {item.trendLabel && (
              <span className="text-[10px] text-muted-foreground truncate">
                {item.trendLabel}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
