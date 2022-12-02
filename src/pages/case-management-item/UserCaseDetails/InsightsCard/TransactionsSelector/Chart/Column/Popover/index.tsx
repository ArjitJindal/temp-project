import React from 'react';
import { Popover as AntPopover } from 'antd';
import { DataItem, Series } from '../../types';
import s from './styles.module.less';
import { P } from '@/components/ui/Typography';
import { Currency } from '@/utils/currencies';
import { ColorIndicator } from '@/pages/case-management-item/UserCaseDetails/InsightsCard/components/Legend';
import { getRuleActionColor } from '@/utils/rules';
import { RuleAction } from '@/apis';
import Money from '@/components/ui/Money';
import {
  getRiskActionLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';

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
      <P className={s.title} variant="sml" bold>
        {`Transactions ${currency == null ? 'count' : 'amount'} on ${series.label}`}
      </P>
      <div className={s.indicatorsTable}>
        {Object.entries(dataItem.values).map(([ruleAction, value]) => (
          <IndicatorRow
            key={ruleAction}
            color={getRuleActionColor(ruleAction as RuleAction)}
            title={getRiskActionLabel(ruleAction as RuleAction, settings) || 'Unknown'}
            value={value}
            currency={currency}
          />
        ))}
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
