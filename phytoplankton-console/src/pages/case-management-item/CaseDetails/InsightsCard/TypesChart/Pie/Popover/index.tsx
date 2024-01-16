import React from 'react';
import { Popover as AntPopover } from 'antd';
import { Currency } from '@flagright/lib/constants';
import s from './styles.module.less';
import { ColorIndicator } from '@/pages/case-management-item/CaseDetails/InsightsCard/components/Legend';
import { P } from '@/components/ui/Typography';
import Money from '@/components/ui/Money';

interface Props {
  category: string;
  isVisible: boolean;
  value: number;
  percent: number;
  color: string;
  children: React.ReactNode;
  currency: Currency | null;
}

export default function Popover(props: Props) {
  const { category, currency, color, value, percent, isVisible, children } = props;
  const content = (
    <div className={s.root}>
      <P className={s.title} variant="sml" bold>
        {currency != null ? 'Amount' : 'Count'} share of transactions
      </P>
      <div className={s.indicatorsTable}>
        <IndicatorRow
          percent={percent}
          color={color}
          title={category}
          currency={currency}
          value={value}
        />
      </div>
    </div>
  );
  return (
    <AntPopover overlayClassName={s.root} visible={isVisible} content={content} placement="top">
      {children}
    </AntPopover>
  );
}

function IndicatorRow(props: {
  color: string;
  title: string;
  value?: number;
  percent: number;
  currency: Currency | null;
}) {
  const { color, title, value, percent, currency } = props;
  return (
    <>
      <ColorIndicator color={color} />
      <div>{title}</div>
      <div>
        {(percent * 100).toFixed(2)}% (
        {currency != null ? <Money currency={currency} value={value} /> : value})
      </div>
    </>
  );
}
