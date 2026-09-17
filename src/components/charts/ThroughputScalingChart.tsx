"use client";

import { useMemo } from "react";
import { Chart } from "./graphite/Chart";
import { graphiteTheme } from "@/lib/graphite.theme";
import type { ThroughputScalingChartProps } from "./ThroughputScalingChart.types";

const X_KEY = "label" as const;

export function ThroughputScalingChart({
  data,
  seriesKeys,
  loading = false,
  emptyState = null,
  title = "Throughput Scaling",
  unit = "MB/s",
  mode = graphiteTheme.defaultMode,
  surface = graphiteTheme.surface,
  className,
}: ThroughputScalingChartProps) {
  const rows = useMemo(() => data.filter(Boolean), [data]);

  if (loading) return <Chart.Skeleton className={className} aria-busy />;
  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <Chart
      type="line"
      theme={{ ...graphiteTheme, curve: "smooth", stroke: 2.5, fill: 18, surface: "solid" }}
      surface={surface}
      mode={mode}
      data={rows}
      x={X_KEY}
      series={seriesKeys}
      title={title}
      unit={unit}
      className={["w-full", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={title}
    />
  );
}
