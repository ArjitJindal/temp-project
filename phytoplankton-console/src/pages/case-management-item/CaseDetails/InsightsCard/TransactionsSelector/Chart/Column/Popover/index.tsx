import React from 'react';
import { Popover as AntPopover } from 'antd';
import { Currency } from '@flagright/lib/constants';
import { DataItem, Series } from '../../types';
import { TRANSACTION_STATE_COLORS } from '..';
import s from './styles.module.less';
import { P } from '@/components/ui/Typography';
import { ColorIndicator } from '@/pages/case-management-item/CaseDetails/InsightsCard/components/Legend';
import { getRuleActionColorForDashboard } from '@/utils/rules';
import { RuleAction, TransactionState } from '@/apis';
import Money from '@/components/ui/Money';
import {
  getRuleActionLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { humanizeAuto } from '@/utils/humanize';

interface Props {
  series: Series;
  dataItem: DataItem;
  isVisible: boolean;
  children: React.ReactNode;
  currency: Currency | null;
}

export default function Popover(props: Props) {
  const { isVisible, series, dataItem, children, currency } = props;
  const settings = useSettings();
  const content = (
    <div className={s.root}>
      <P className={s.title} variant="m" fontWeight="normal" bold>
        {`Transactions ${currency == null ? 'count' : 'amount'} on ${series.label}`}
      </P>
      <div className={s.indicatorsTable}>
        {Object.entries(dataItem.values).map(([status, value]) => {
          const isState = status in TRANSACTION_STATE_COLORS;
          const color = isState
            ? TRANSACTION_STATE_COLORS[status as TransactionState]
            : getRuleActionColorForDashboard(status as RuleAction);
          const title = isState
            ? humanizeAuto(status)
            : getRuleActionLabel(status as RuleAction, settings) || 'Unknown';
          return (
            <IndicatorRow
              key={status}
              color={color}
              title={title}
              value={value}
              currency={currency}
            />
          );
        })}
      </div>
    </div>
  );
  return (
    <AntPopover
      overlayClassName={s.root}
      key={`${isVisible}`}
      visible={isVisible}
      content={content}
      placement="top"
    >
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
