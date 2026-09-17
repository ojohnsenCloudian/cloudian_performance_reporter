"use client";

import { useMemo } from "react";
import { Chart } from "./graphite/Chart";
import { graphiteTheme } from "@/lib/graphite.theme";
import type { LatencyRankChartProps } from "./LatencyRankChart.types";

const X_KEY = "label" as const;
const VALUE_KEYS = ["value"] as const;

export function LatencyRankChart({
  data,
  loading = false,
  emptyState = null,
  title = "Peak Latency by Config",
  unit = "ms",
  mode = graphiteTheme.defaultMode,
  surface = graphiteTheme.surface,
  className,
}: LatencyRankChartProps) {
  const rows = useMemo(() => data.filter(Boolean), [data]);

  if (loading) return <Chart.Skeleton className={className} aria-busy />;
  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <Chart
      type="bar"
      theme={{ ...graphiteTheme, legend: false, labels: true }}
      surface={surface}
      mode={mode}
      data={rows}
      x={X_KEY}
      value={VALUE_KEYS}
      title={title}
      unit={unit}
      className={["w-full", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={title}
    />
  );
}
