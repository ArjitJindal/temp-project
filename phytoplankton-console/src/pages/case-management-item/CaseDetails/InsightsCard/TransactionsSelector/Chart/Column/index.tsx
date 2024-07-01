import cn from 'clsx';
import React from 'react';
import { Currency } from '@flagright/lib/constants';
import { CalculatedParams, DataItem, Series } from '../types';
import s from './styles.module.less';
import Popover from './Popover';
import { RuleAction, TransactionState } from '@/apis';
import { getRuleActionColorForDashboard } from '@/utils/rules';
import COLORS from '@/components/ui/colors';

export const TRANSACTION_STATE_COLORS: {
  [key in TransactionState]: string;
} = {
  CREATED: COLORS.yellow.base,
  PROCESSING: COLORS.orange.base,
  SENT: COLORS.brandBlue.base,
  EXPIRED: COLORS.purpleGray.base,
  DECLINED: COLORS.red.base,
  SUSPENDED: COLORS.lightRed.base,
  REFUNDED: COLORS.green.base,
  SUCCESSFUL: COLORS.lightGreen.base,
  REVERSED: COLORS.purple.base,
};

function Category(props: {
  ruleAction?: RuleAction;
  transactionState?: TransactionState;
  value: number;
  total: number;
  currency: Currency | null;
}) {
  const { ruleAction, value, total, transactionState } = props;
  const color = ruleAction
    ? getRuleActionColorForDashboard(ruleAction)
    : TRANSACTION_STATE_COLORS[transactionState as TransactionState];
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
          {Object.entries(item.values).map(([status, value]) => {
            const isState = status.toUpperCase() in TRANSACTION_STATE_COLORS;
            const keys = isState
              ? {
                  transactionState: status.toUpperCase() as TransactionState,
                }
              : {
                  ruleAction: status as RuleAction,
                };
            return (
              <Category key={status} total={total} value={value} currency={currency} {...keys} />
            );
          })}
        </div>
      </Popover>
    </div>
  );
}
