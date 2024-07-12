import cn from 'clsx';
import React from 'react';
import { Currency } from '@flagright/lib/constants';
import Label from '../Label';
import s from './styles.module.less';
import Money from '@/components/ui/Money';
import { LEFT_PADDING } from '@/pages/case-management-item/CaseDetails/InsightsCard/TransactionsSelector/Chart/helpers';

interface Props {
  max: number;
  ticks: number[];
  totalHeight: number;
  currency: Currency | null;
}

export default function AxisY(props: Props) {
  const { max, totalHeight, ticks, currency } = props;

  return (
    <div className={cn(s.root)}>
      {ticks.map((tick) => {
        const bottom = totalHeight * (tick / max);
        return (
          <React.Fragment key={tick}>
            <div className={s.tick} style={{ bottom: bottom }}></div>

            <Label
              size={{ width: LEFT_PADDING - 20 }}
              position={{ bottom: bottom }}
              className={s.label}
            >
              {currency ? (
                <Money compact currency={currency} value={tick} />
              ) : (
                `${tick % 1 === 0 ? tick : tick.toFixed(1)}`
              )}
            </Label>
          </React.Fragment>
        );
      })}
    </div>
  );
}
