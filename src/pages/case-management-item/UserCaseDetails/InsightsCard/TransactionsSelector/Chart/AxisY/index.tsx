import cn from 'clsx';
import React from 'react';
import Label from '../Label';
import s from './styles.module.less';
import { Currency, formatCurrency } from '@/utils/currencies';

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
            <Label position={{ bottom: bottom }} className={s.label}>
              {currency ? formatCurrency(tick, currency) : `${Math.round(tick)}`}
            </Label>
          </React.Fragment>
        );
      })}
    </div>
  );
}
