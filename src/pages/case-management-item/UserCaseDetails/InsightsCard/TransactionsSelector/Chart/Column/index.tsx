import cn from 'clsx';
import React from 'react';
import { DataItem } from '../types';
import s from './styles.module.less';
import { RuleAction } from '@/apis';
import { getRuleActionColor } from '@/utils/rules';
import { Currency, formatCurrency } from '@/utils/currencies';
import { humanizeCamelCase } from '@/utils/tags';

function Category(props: {
  ruleAction: RuleAction;
  value: number;
  total: number;
  currency: Currency | null;
}) {
  const { ruleAction, value, total, currency } = props;
  const color = getRuleActionColor(ruleAction);
  return (
    <div
      title={`${humanizeCamelCase(ruleAction)}: ${
        currency ? formatCurrency(value, currency) : `${Math.round(value)}`
      }`}
      className={cn(s.category)}
      style={{
        background: color,
        height: `${(value / total) * 100}%`,
      }}
    />
  );
}

interface Props {
  item: DataItem;
  height: number;
  width: number;
  left: number;
  currency: Currency | null;
}

export default function Column(props: Props) {
  const { item, height: height, width, left, currency } = props;
  const total = Object.values(item.values).reduce((acc, x) => acc + x, 0);
  return (
    <div
      className={s.column}
      style={{
        left,
        height,
        width,
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
  );
}
