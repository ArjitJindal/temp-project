import cn from 'clsx';
import React from 'react';
import Label from '../Label';
import { CalculatedParams } from '../types';
import s from './styles.module.less';

interface Props {
  calculatedParams: CalculatedParams;
  seriesList: { name: string; label: string }[];
}

export default function AxisX(props: Props) {
  const { seriesList, calculatedParams } = props;
  const { columnWidth, gap } = calculatedParams;
  return (
    <div className={cn(s.root)}>
      {seriesList.map(({ name, label }, i) => (
        <div
          key={name}
          className={s.label}
          style={{ left: (gap + columnWidth) * i, width: columnWidth }}
          title={name}
        >
          <Label className={s.labelText} fontSize={calculatedParams.xLabelFontSize}>
            {label}
          </Label>
        </div>
      ))}
    </div>
  );
}
