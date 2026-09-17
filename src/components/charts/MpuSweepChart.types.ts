import type { ReactNode } from "react";
import type { ChartMode, ChartSurface } from "./graphite/Chart";

export interface MpuSweepDatum {
  label: string;
  throughput: number;
  latency: number;
}

export interface MpuSweepChartProps {
  readonly data: readonly MpuSweepDatum[];
  readonly title?: string;
  readonly unit?: string;
  readonly loading?: boolean;
  readonly emptyState?: ReactNode;
  readonly mode?: ChartMode;
  readonly surface?: ChartSurface;
  readonly className?: string;
}
