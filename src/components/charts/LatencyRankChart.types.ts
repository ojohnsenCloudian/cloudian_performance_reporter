import type { ReactNode } from "react";
import type { ChartMode, ChartSurface } from "./graphite/Chart";

export interface LatencyRankDatum {
  label: string;
  value: number;
}

export interface LatencyRankChartProps {
  readonly data: readonly LatencyRankDatum[];
  readonly title?: string;
  readonly unit?: string;
  readonly loading?: boolean;
  readonly emptyState?: ReactNode;
  readonly mode?: ChartMode;
  readonly surface?: ChartSurface;
  readonly className?: string;
}
