import React from 'react';
import { Popover as AntPopover } from 'antd';
import s from './styles.module.less';
import { P } from '@/components/ui/Typography';
import { Currency } from '@/utils/currencies';
import { ColorIndicator } from '@/pages/case-management-item/CaseDetails/InsightsCard/components/Legend';
import {
  Colors,
  DataItem,
} from '@/pages/case-management-item/CaseDetails/InsightsCard/AmountsChart/Chart/types';
import Money from '@/components/ui/Money';

interface Props {
  colors: Colors;
  dataItem: DataItem;
  isVisible: boolean;
  children: React.ReactNode;
  currency: Currency | null;
}

export default function Popover(props: Props) {
  const { isVisible, dataItem, children, colors, currency } = props;
  const content = (
    <div className={s.root}>
      <P className={s.title} variant="sml" bold>
        {`Transaction amount for ${dataItem.title}`}
      </P>
      <div className={s.indicatorsTable}>
        <IndicatorRow
          color={colors.maximum}
          title={'Maximum'}
          value={dataItem.maximum}
          currency={currency}
        />
        <IndicatorRow
          color={colors.minimum}
          title={'Minimum'}
          value={dataItem.minimum}
          currency={currency}
        />
        <IndicatorRow
          color={colors.average}
          title={'Average'}
          value={dataItem.average}
          currency={currency}
        />
        <IndicatorRow
          color={colors.median}
          title={'Median'}
          value={dataItem.median}
          currency={currency}
        />
      </div>
    </div>
  );
  return (
    <AntPopover visible={isVisible} content={content} placement="topLeft">
      {children}
    </AntPopover>
  );
}

function IndicatorRow(props: {
  color: string;
  title: string;
  value?: number;
  currency: Currency | null;
}) {
  const { color, title, value, currency } = props;
  return (
    <>
      <ColorIndicator color={color} />
      <div>{title}</div>
      <div>
        {currency != null && value != null ? <Money currency={currency} value={value} /> : value}
      </div>
    </>
  );
}
