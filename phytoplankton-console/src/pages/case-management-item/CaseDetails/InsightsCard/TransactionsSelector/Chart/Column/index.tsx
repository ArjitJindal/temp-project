import cn from 'clsx';
import React from 'react';
import { CalculatedParams, DataItem, Series } from '../types';
import s from './styles.module.less';
import Popover from './Popover';
import { RuleAction } from '@/apis';
import { getRuleActionColorForDashboard } from '@/utils/rules';
import { Currency } from '@/utils/currencies';

function Category(props: {
  ruleAction: RuleAction;
  value: number;
  total: number;
  currency: Currency | null;
}) {
  const { ruleAction, value, total } = props;
  const color = getRuleActionColorForDashboard(ruleAction);
  return (
    <div
      className={cn(s.category)}
      style={{
        background: color,
        height: `${(value / total) * 100}%`,
      }}
    />
  );
}

interface Props {
  isHighlighted: boolean;
  isShadowed: boolean;
  series: Series;
  item: DataItem;
  height: number;
  index: number;
  calculatedParams: CalculatedParams;
  currency: Currency | null;
  onHighlight: (highlighted: boolean) => void;
}

export default function Column(props: Props) {
  const {
    series,
    item,
    height: height,
    calculatedParams,
    currency,
    isShadowed,
    isHighlighted,
    index,
    onHighlight,
  } = props;
  const total = Object.values(item.values).reduce((acc, x) => acc + x, 0);
  return (
    <div
      className={cn(s.root, isShadowed && s.isShadowed)}
      onMouseEnter={() => {
        onHighlight(true);
      }}
      onMouseLeave={() => {
        onHighlight(false);
      }}
      style={{
        left:
          (calculatedParams.columnWidth + calculatedParams.gap) * index - calculatedParams.gap / 2,
        width: calculatedParams.columnWidth + calculatedParams.gap,
        height: '100%',
      }}
    >
      <Popover isVisible={isHighlighted} currency={currency} dataItem={item} series={series}>
        <div
          className={cn(s.column, isShadowed && s.isShadowed)}
          style={{
            height,
            width: calculatedParams.columnWidth,
          }}
        >
          {Object.entries(item.values).map(([status, value]) => (
            <Category
              key={status}
              total={total}
              value={value}
              ruleAction={status as RuleAction}
              currency={currency}
            />
          ))}
        </div>
      </Popover>
    </div>
  );
}
