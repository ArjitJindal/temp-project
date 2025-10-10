import React, { useState } from 'react';
import { Currency } from '@flagright/lib/constants';
import s from './styles.module.less';
import Column from './Column';
import { DataItem, Series, Settings } from './types';
import {
  BOTTOM_PADDING,
  LEFT_PADDING,
  RIGHT_PADDING,
  TOP_PADDING,
  useColumnParams,
  Y_TICKS_COUNT,
} from './helpers';
import AxisX from './AxisX';
import AxisY from './AxisY';

interface Props {
  settings: Settings;
  seriesList: Series[];
  data: DataItem[];
  currency: Currency | null;
}

export default function CountChart(props: Props) {
  const { data, seriesList, settings, currency } = props;
  const { width, height } = settings;
  const usefulWidth = width - LEFT_PADDING - RIGHT_PADDING;
  const usefulHeight = height - TOP_PADDING - BOTTOM_PADDING;

  const calculatedParams = useColumnParams(data, seriesList, usefulWidth);

  const [highlightedColumn, setHighlightedColumn] = useState<string | null>(null);

  const yTicksCount = Math.min(Y_TICKS_COUNT, calculatedParams.yMax);
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
          <AxisX seriesList={seriesList} calculatedParams={calculatedParams} />
          <AxisY
            max={calculatedParams.yMax}
            totalHeight={usefulHeight}
            ticks={[...new Array(Y_TICKS_COUNT + 1)].map(
              (_, i) => (calculatedParams.yMax / yTicksCount) * i,
            )}
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
                index={i}
                isHighlighted={highlightedColumn != null && series.name === highlightedColumn}
                isShadowed={highlightedColumn != null && series.name !== highlightedColumn}
                key={series.name}
                item={dataItem}
                series={series}
                calculatedParams={calculatedParams}
                height={usefulHeight * (total / calculatedParams.yMax)}
                currency={currency}
                onHighlight={(highlighted) => {
                  setHighlightedColumn(highlighted ? series.name : null);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
