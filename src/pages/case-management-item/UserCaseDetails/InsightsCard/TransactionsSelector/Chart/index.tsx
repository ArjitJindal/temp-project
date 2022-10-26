import React from 'react';
import s from './styles.module.less';
import Column from './Column';
import { DataItem, Settings } from './types';
import {
  BOTTOM_PADDING,
  calculateScaleMax,
  GAP,
  LEFT_PADDING,
  MAX_COLUMN_WIDTH,
  RIGHT_PADDING,
  TOP_PADDING,
} from './helpers';
import AxisX from './AxisX';
import AxisY from './AxisY';
import { Currency } from '@/utils/currencies';

interface Props {
  settings: Settings;
  seriesList: { name: string; label: string }[];
  data: DataItem[];
  currency: Currency | null;
}

export default function CountChart(props: Props) {
  const { data, seriesList, settings, currency } = props;
  const { width, height } = settings;
  const usefulWidth = width - LEFT_PADDING - RIGHT_PADDING;
  const usefulHeight = height - TOP_PADDING - BOTTOM_PADDING;
  const columnWidth = Math.min(
    (usefulWidth - GAP * (seriesList.length - 1)) / seriesList.length,
    MAX_COLUMN_WIDTH,
  );
  const TICKS_COUNT = 5;
  const max = calculateScaleMax(
    data
      .map((dataItem) => Object.values(dataItem.values).reduce((acc, x) => acc + x, 0))
      .reduce((acc, x) => Math.max(acc, x), 10),
  );
  return (
    <div className={s.root} style={{ width, height }}>
      <div
        className={s.offset}
        style={{
          width: usefulWidth,
          height: usefulHeight,
          bottom: BOTTOM_PADDING,
          left: LEFT_PADDING,
        }}
      >
        <div className={s.grid}>
          <AxisX seriesList={seriesList} columnWidth={columnWidth} />
          <AxisY
            max={max}
            totalHeight={usefulHeight}
            ticks={[...new Array(TICKS_COUNT + 1)].map((_, i) => (max / TICKS_COUNT) * i)}
            currency={currency}
          />
        </div>
        <div className={s.columns}>
          {seriesList.map((series, i) => {
            const dataItem = data.find((x) => x.series === series.name);
            if (dataItem == null) {
              return <React.Fragment key={series.name}></React.Fragment>;
            }
            const total = Object.values(dataItem.values).reduce((acc, x) => acc + x, 0);
            return (
              <Column
                key={series.name}
                item={dataItem}
                width={columnWidth}
                height={height * (total / max)}
                left={(GAP + columnWidth) * i}
                currency={currency}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
