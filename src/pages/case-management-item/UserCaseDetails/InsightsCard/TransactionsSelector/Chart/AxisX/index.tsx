import cn from 'clsx';
import React from 'react';
import Label from '../Label';
import { GAP } from '../helpers';
import s from './styles.module.less';

interface Props {
  columnWidth: number;
  seriesList: { name: string; label: string }[];
}

export default function AxisX(props: Props) {
  const { seriesList, columnWidth } = props;
  return (
    <div className={cn(s.root)}>
      {seriesList.map(({ name, label }, i) => (
        <div
          key={name}
          className={s.label}
          style={{ left: (GAP + columnWidth) * i, width: columnWidth }}
          title={name}
        >
          <Label size={{ width: columnWidth }}>{label}</Label>
        </div>
      ))}
    </div>
  );
}
