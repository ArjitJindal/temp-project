import React, { useState } from 'react';
import cn from 'clsx';
import { Currency } from '@flagright/lib/constants';
import s from './styles.module.less';
import Popover from './Popover';
import { P } from '@/components/ui/Typography';
import {
  Colors,
  Data,
} from '@/pages/case-management-item/CaseDetails/InsightsCard/AmountsChart/Chart/types';
import { useCalculatedParams } from '@/pages/case-management-item/CaseDetails/InsightsCard/AmountsChart/Chart/helpers';
import Money from '@/components/ui/Money';

interface Props {
  data: Data;
  colors: Colors;
  currency: Currency;
}

export default function Chart(props: Props) {
  const { currency, data, colors } = props;

  const [focused, setFocused] = useState<string | null>(null);

  const calculatedParams = useCalculatedParams(data);

  return (
    <div className={s.root}>
      <div className={s.content}>
        <Grid data={data} max={calculatedParams.yMax} currency={currency} />
        {data.map((dataItem) => {
          const { title, maximum, minimum, average, median } = dataItem;
          const isFocused = focused === title;
          const isGhosted = !isFocused && focused != null;
          return (
            <React.Fragment key={title}>
              <P
                variant="m"
                fontWeight="normal"
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
                  {maximum != null && (
                    <div
                      className={cn(s.indicator, s.maximum)}
                      style={{
                        width: `${(maximum / calculatedParams.yMax) * 100}%`,
                        background: colors.maximum,
                      }}
                    />
                  )}
                  {minimum != null && (
                    <div
                      className={cn(s.indicator, s.minimum)}
                      style={{
                        width: `${(minimum / calculatedParams.yMax) * 100}%`,
                        background: colors.minimum,
                      }}
                    />
                  )}
                  {average != null && (
                    <div
                      className={cn(s.indicator, s.average)}
                      style={{
                        width: `${(average / calculatedParams.yMax) * 100}%`,
                        background: colors.average,
                      }}
                    />
                  )}
                  {median != null && (
                    <div
                      className={cn(s.indicator, s.median)}
                      style={{
                        left: `${(median / calculatedParams.yMax) * 100}%`,
                        background: colors.median,
                      }}
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
          <Money
            className={s.gridLabel}
            currency={currency}
            value={(max / (GRID_STEPS_COUNT - 1)) * i}
            compact
          />
        </div>
      ))}
    </div>
  );
}
