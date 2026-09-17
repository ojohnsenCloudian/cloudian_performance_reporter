import type { ReactNode } from "react";
import type { ChartMode, ChartSurface } from "./graphite/Chart";

export interface PeakSparklineDatum {
  label: string;
  values: number[];
}

export interface PeakSparklineProps {
  readonly data: readonly PeakSparklineDatum[];
  readonly title?: string;
  readonly unit?: string;
  readonly loading?: boolean;
  readonly emptyState?: ReactNode;
  readonly mode?: ChartMode;
  readonly surface?: ChartSurface;
  readonly className?: string;
}
