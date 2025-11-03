import React from 'react';
import { Currency } from '@flagright/lib/constants';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { DataItem, Series } from '../../types';
import { TRANSACTION_STATE_COLORS, getCurrencyColor } from '..';
import s from './styles.module.less';
import PopoverComponent from '@/components/ui/Popover';
import { P } from '@/components/ui/Typography';
import { ColorIndicator } from '@/pages/case-management-item/CaseDetails/InsightsCard/components/Legend';
import { getRuleActionColorForDashboard } from '@/utils/rules';
import { CurrencyCode, RuleAction, TransactionState } from '@/apis';
import Money from '@/components/ui/Money';
import {
  getRuleActionLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { isValidCurrencyCode } from '@/apis/models-custom/CurrencyCode';

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
          const isState = status.toUpperCase() in TRANSACTION_STATE_COLORS;
          const isRuleAction = ['ALLOW', 'SUSPEND', 'BLOCK', 'FLAG'].includes(status.toUpperCase());

          const color = isState
            ? TRANSACTION_STATE_COLORS[status.toUpperCase() as TransactionState]
            : isRuleAction
            ? getRuleActionColorForDashboard(status as RuleAction)
            : getCurrencyColor(status as CurrencyCode);

          const title = isState
            ? humanizeAuto(status)
            : isValidCurrencyCode(status)
            ? status.toUpperCase()
            : isRuleAction
            ? getRuleActionLabel(status as RuleAction, settings) || 'Unknown'
            : status; // For currency codes, just show the code
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
    <PopoverComponent
      disablePointerEvents
      key={`${isVisible}`}
      visible={isVisible}
      content={content}
      placement="top"
    >
      {children}
    </PopoverComponent>
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
