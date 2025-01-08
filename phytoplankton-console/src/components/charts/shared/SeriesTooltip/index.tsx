import React from 'react';
import s from './index.module.less';
import DefaultChartTooltip from '@/components/charts/shared/DefaultChartTooltip';

interface Props {
  title?: string;
  items: {
    color?: string;
    label: string;
    value: string;
  }[];
}

export default function SeriesTooltip(props: Props) {
  const { title, items } = props;

  return (
    <DefaultChartTooltip>
      <div className={s.root}>
        {title && <div className={s.title}>{title}</div>}
        {items.map(({ color, label, value }, i) => (
          <div key={i} className={s.item}>
            {color && <div className={s.color} style={{ backgroundColor: color }} />}
            <div className={s.label}>{label}:</div>
            <div className={s.value}>{value}</div>
          </div>
        ))}
      </div>
    </DefaultChartTooltip>
  );
}
