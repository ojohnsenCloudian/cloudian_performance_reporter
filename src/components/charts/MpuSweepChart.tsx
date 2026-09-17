"use client";

import { useMemo } from "react";
import { Chart } from "./graphite/Chart";
import { graphiteTheme } from "@/lib/graphite.theme";
import type { MpuSweepChartProps } from "./MpuSweepChart.types";

const X_KEY = "label" as const;
const SERIES_KEYS = ["throughput", "latency"] as const;

export function MpuSweepChart({
  data,
  loading = false,
  emptyState = null,
  title = "Multipart Upload — Throughput vs Part Size",
  unit = "MB/s",
  mode = graphiteTheme.defaultMode,
  surface = graphiteTheme.surface,
  className,
}: MpuSweepChartProps) {
  const rows = useMemo(() => data.filter(Boolean), [data]);

  if (loading) return <Chart.Skeleton className={className} aria-busy />;
  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <Chart
      type="area"
      theme={{ ...graphiteTheme, fill: 0.35 }}
      surface={surface}
      mode={mode}
      data={rows}
      x={X_KEY}
      series={SERIES_KEYS}
      title={title}
      unit={unit}
      className={["w-full", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={title}
    />
  );
}
