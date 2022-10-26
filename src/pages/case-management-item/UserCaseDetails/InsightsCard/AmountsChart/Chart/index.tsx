import React, { useState } from 'react';
import cn from 'clsx';
import s from './styles.module.less';
import Popover from './Popover';
import { P } from '@/components/ui/Typography';
import { Currency, formatCurrency } from '@/utils/currencies';
import { calculateScaleMax } from '@/pages/case-management-item/UserCaseDetails/InsightsCard/TransactionsSelector/Chart/helpers';

export interface Colors {
  maximum: string;
  minimum: string;
  average: string;
  median: string;
}

export interface DataItem {
  title: string;
  maximum?: number;
  minimum?: number;
  average?: number;
  median?: number;
}

export type Data = DataItem[];

interface Props {
  data: Data;
  colors: Colors;
  currency: Currency;
}

export default function Chart(props: Props) {
  const { currency, data, colors } = props;
  const max = calculateScaleMax(
    data.reduce(
      (acc, { maximum, minimum, median, average }) =>
        Math.max(acc, maximum ?? 0, minimum ?? 0, median ?? 0, average ?? 0),
      0,
    ),
  );
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <div className={s.root}>
      <div className={s.content}>
        <Grid data={data} max={max} currency={currency} />
        {data.map((dataItem) => {
          const { title, maximum, minimum, average, median } = dataItem;
          const isFocused = focused === title;
          const isGhosted = !isFocused && focused != null;
          return (
            <React.Fragment key={title}>
              <P
                variant="sml"
                className={cn(s.label, isGhosted && s.isGhosted)}
                onMouseEnter={() => {
                  setFocused(title);
                }}
                onMouseLeave={() => {
                  setFocused(null);
                }}
              >
                {title}
              </P>
              <Popover
                isVisible={isFocused}
                dataItem={dataItem}
                currency={currency}
                colors={colors}
              >
                <div
                  className={cn(s.series, isGhosted && s.isGhosted)}
                  onMouseEnter={() => {
                    setFocused(title);
                  }}
                  onMouseLeave={() => {
                    setFocused(null);
                  }}
                >
                  {maximum && (
                    <div
                      title={`Maximum: ${formatCurrency(maximum, currency)}`}
                      className={cn(s.indicator, s.maximum)}
                      style={{ width: `${(maximum / max) * 100}%`, background: colors.maximum }}
                    />
                  )}
                  {minimum && (
                    <div
                      title={`Minimum: ${formatCurrency(minimum, currency)}`}
                      className={cn(s.indicator, s.minimum)}
                      style={{ width: `${(minimum / max) * 100}%`, background: colors.minimum }}
                    />
                  )}
                  {average && (
                    <div
                      title={`Average: ${formatCurrency(average, currency)}`}
                      className={cn(s.indicator, s.average)}
                      style={{ width: `${(average / max) * 100}%`, background: colors.average }}
                    />
                  )}
                  {median && (
                    <div
                      title={`Median: ${formatCurrency(median, currency)}`}
                      className={cn(s.indicator, s.median)}
                      style={{ left: `${(median / max) * 100}%`, background: colors.median }}
                    />
                  )}
                </div>
              </Popover>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

const GRID_STEPS_COUNT = 5;

function Grid(props: { data: Data; max: number; currency: Currency }) {
  const { currency, max } = props;
  return (
    <div className={s.grid}>
      {[...new Array(GRID_STEPS_COUNT)].map((_, i) => (
        <div key={i} className={s.gridLine}>
          <span>{formatCurrency((max / (GRID_STEPS_COUNT - 1)) * i, currency)}</span>
        </div>
      ))}
    </div>
  );
}
