"use client";

import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { chartColors } from "@/lib/chart-colors";

interface SparklineProps {
  data: Array<{ value: number } & Record<string, any>>;
  /** Color of the line. Defaults to brand primary. */
  color?: string;
  /** Height in px. Default 36. */
  height?: number;
  /** Optional class for the wrapper. */
  className?: string;
  /** dataKey to render. Default "value". */
  dataKey?: string;
}

let sparkIdCounter = 0;
const nextId = () => `spark-grad-${++sparkIdCounter}`;

/**
 * Tiny inline area chart for KPI cards (no axes, no tooltip, no grid).
 * Just the trend shape with a soft gradient fill.
 */
export function Sparkline({
  data,
  color = chartColors.primary,
  height = 36,
  className,
  dataKey = "value",
}: SparklineProps) {
  // Stable id per render so SVG gradient defs don't collide
  const gradId = nextId();
  return (
    <div className={className} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* Hidden YAxis ensures the line uses full vertical range */}
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
