import type { ReactNode } from "react";
import type { ChartMode, ChartSurface } from "./graphite/Chart";

/** One row: x label + one numeric field per config series. */
export type ThroughputScalingRow = Record<string, string | number>;

export interface ThroughputScalingChartProps {
  readonly data: readonly ThroughputScalingRow[];
  /** The series key names (config names) to render as lines. */
  readonly seriesKeys: readonly string[];
  readonly title?: string;
  readonly unit?: string;
  readonly loading?: boolean;
  readonly emptyState?: ReactNode;
  readonly mode?: ChartMode;
  readonly surface?: ChartSurface;
  readonly className?: string;
}
