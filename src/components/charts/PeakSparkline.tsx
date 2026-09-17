"use client";

import { useMemo } from "react";
import { Chart } from "./graphite/Chart";
import { graphiteTheme } from "@/lib/graphite.theme";
import type { PeakSparklineProps } from "./PeakSparkline.types";

const X_KEY = "label" as const;
const VALUES_KEYS = ["values"] as const;

export function PeakSparkline({
  data,
  loading = false,
  emptyState = null,
  title = "Throughput Trend",
  unit = "MB/s",
  mode = graphiteTheme.defaultMode,
  surface = "transparent",
  className,
}: PeakSparklineProps) {
  const rows = useMemo(() => data.filter(Boolean), [data]);

  if (loading) return <Chart.Skeleton className={className} aria-busy />;
  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <Chart
      type="sparkline"
      theme={{ ...graphiteTheme, legend: false, labels: false, radius: 8 }}
      surface={surface}
      mode={mode}
      data={rows}
      x={X_KEY}
      values={VALUES_KEYS}
      title={title}
      unit={unit}
      className={["w-full", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={title}
    />
  );
}
