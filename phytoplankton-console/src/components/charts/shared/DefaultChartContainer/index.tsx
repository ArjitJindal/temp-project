import React, { useState } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { useElementSize } from '@/utils/browser';
import { Size } from '@/components/charts/shared/helpers';

type Orientation = 'VERTICAL' | 'HORIZONTAL';

export interface DefaultLegendProps {
  orientation: Orientation;
  showSkeleton: boolean;
}

export interface DefaultChartProps {
  showSkeleton: boolean;
  size: Size;
}

interface Props {
  height?: number;
  hideLegend?: boolean;
  showSkeleton?: boolean;
  orientation?: Orientation;
  renderChart: (renderProps: DefaultChartProps) => React.ReactNode;
  renderLegend?: (renderProps: DefaultLegendProps) => React.ReactNode;
}

export default function DefaultChartContainer(props: Props) {
  const {
    showSkeleton = false,
    orientation = 'VERTICAL',
    renderChart,
    renderLegend,
    height = 400,
    hideLegend,
  } = props;
  const [rootRef, setRootRef] = useState<HTMLElement | null>(null);
  const size = useElementSize(rootRef);

  return (
    <div
      className={cn(s.root, showSkeleton && s.showSkeleton, s[`orientation-${orientation}`])}
      style={{ height: height }}
    >
      <div ref={setRootRef} className={s.chartContainer}>
        <div className={s.chartPosition}>{size && renderChart({ size, showSkeleton })}</div>
      </div>
      {!hideLegend && renderLegend != null && (
        <div className={s.legendContainer}>
          {renderLegend({
            orientation: orientation === 'VERTICAL' ? 'HORIZONTAL' : 'VERTICAL',
            showSkeleton,
          })}
        </div>
      )}
    </div>
  );
}
