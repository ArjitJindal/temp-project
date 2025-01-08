import { StringLike } from '@visx/scale';
import { ScaleOrdinal } from 'd3-scale';
import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { COLORS_V2_SKELETON_COLOR } from '@/components/ui/colors';
import { DefaultLegendProps } from '@/components/charts/shared/DefaultChartContainer';

interface Props<Series extends StringLike> extends Partial<DefaultLegendProps> {
  scale: ScaleOrdinal<Series, string>;
  disabledSeries?: Series[];
  onItemClick?: (series: Series, disabled: boolean) => void;
  onItemMouseMove?: (series: Series) => void;
  onItemMouseLeave?: (series: Series) => void;
}

export default function CustomLegendOrdinal<Series extends StringLike>(props: Props<Series>) {
  const {
    orientation = 'HORIZONTAL',
    scale,
    disabledSeries = [],
    showSkeleton = false,
    onItemClick,
    onItemMouseMove,
    onItemMouseLeave,
  } = props;
  return (
    <div className={cn(s.root, showSkeleton && s.showSkeleton, s[`orientation-${orientation}`])}>
      {scale.domain().map((x) => {
        const isSeriesDisabled = disabledSeries.includes(x);
        return (
          <div
            key={x.toString()}
            className={cn(s.item, onItemClick && s.isClickable, isSeriesDisabled && s.isDisabled)}
            onClick={
              onItemClick
                ? () => {
                    const toDisable = !isSeriesDisabled;
                    onItemClick(x, toDisable);
                    if (toDisable) {
                      onItemMouseLeave?.(x);
                    } else {
                      onItemMouseMove?.(x);
                    }
                  }
                : undefined
            }
            onMouseMove={
              !isSeriesDisabled
                ? () => {
                    onItemMouseMove?.(x);
                  }
                : undefined
            }
            onMouseLeave={
              !isSeriesDisabled
                ? () => {
                    onItemMouseLeave?.(x);
                  }
                : undefined
            }
          >
            <div
              className={s.color}
              style={{ backgroundColor: showSkeleton ? COLORS_V2_SKELETON_COLOR : scale(x) }}
            />
            <div className={s.itemTitle}>{x.toString()}</div>
          </div>
        );
      })}
    </div>
  );
}
