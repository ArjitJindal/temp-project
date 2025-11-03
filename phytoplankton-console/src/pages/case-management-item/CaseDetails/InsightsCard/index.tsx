import React, { useState } from 'react';
import cn from 'clsx';
import { Currency } from '@flagright/lib/constants';
import s from './styles.module.less';
import TransactionsSelector, { AggregateByField, Params } from './TransactionsSelector';
import TypesChart from './TypesChart';
import AmountsChart from './AmountsChart';
import InsightCard from './components/InsightCard';
import * as Card from '@/components/ui/Card';
import PulseLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import TransactionsList from '@/pages/case-management-item/CaseDetails/InsightsCard/TransactionsList';
import { SortOrder, TransactionsStatsByTypesResponseData } from '@/apis';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { dayjs } from '@/utils/dayjs';
import { useTransactionStats } from '@/utils/api/transactions';
import { QueryResult } from '@/utils/queries/types';

export const FIXED_API_PARAMS = {
  afterTimestamp: 0,
  beforeTimestamp: Number.MAX_SAFE_INTEGER,
  sortField: 'timestamp',
  sortOrder: 'descend' as SortOrder,
};

interface Props {
  userId: string;
  title?: string;
}

export default function InsightsCard(props: Props) {
  const { userId } = props;
  const settings = useSettings();
  const [selectorParams, setSelectorParams] = useState<Params>({
    selectedRuleActions: [],
    selectedTransactionStates: [],
    displayBy: 'COUNT',
    transactionsCount: 10,
    currency: (settings?.defaultValues?.currency ?? 'USD') as unknown as Currency,
    aggregateBy: 'status' as AggregateByField,
    timeRange: [dayjs().subtract(3, 'month'), dayjs()],
  });
  const statsQueryResult = useTransactionStats({
    type: 'by-type',
    selectorParams,
    referenceCurrency: selectorParams.currency,
    userId,
  }) as QueryResult<TransactionsStatsByTypesResponseData[]>;
  return (
    <Card.Root>
      <Card.Section className={s.root}>
        <TransactionsSelector
          currency={selectorParams.currency}
          userId={userId}
          params={selectorParams}
          onChangeParams={setSelectorParams}
        />
      </Card.Section>
      <Card.Section className={cn(s.subtitle, s.gray)} direction="horizontal">
        <PulseLineIcon className={s.icon} />
        {'Insights based on selected transactions'}
      </Card.Section>
      <Card.Row className={s.insights} justify="evenly">
        <Card.Section className={s.gray}>
          <InsightCard title="Transaction types">
            <TypesChart
              currency={selectorParams.displayBy === 'AMOUNT' ? selectorParams.currency : null}
              queryResult={statsQueryResult}
            />
          </InsightCard>
        </Card.Section>
        <Card.Section>
          <InsightCard title="Transaction amounts">
            <AmountsChart currency={selectorParams.currency} queryResult={statsQueryResult} />
          </InsightCard>
        </Card.Section>
      </Card.Row>
      <Card.Section>
        <InsightCard title="Transactions">
          <TransactionsList userId={userId} selectorParams={selectorParams} />
        </InsightCard>
      </Card.Section>
    </Card.Root>
  );
}
