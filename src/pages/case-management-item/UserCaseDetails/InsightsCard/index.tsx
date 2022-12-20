import React, { useState } from 'react';
import cn from 'clsx';
import s from './styles.module.less';
import TransactionsSelector, { Params } from './TransactionsSelector';
import TypesChart from './TypesChart';
import AmountsChart from './AmountsChart';
import InsightCard from './components/InsightCard';
import * as Card from '@/components/ui/Card';
import PulseLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import TransactionsList from '@/pages/case-management-item/UserCaseDetails/InsightsCard/TransactionsList';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { TRANSACTIONS_STATS } from '@/utils/queries/keys';
import { TransactionsStatsByTypesResponseData } from '@/apis';
import { QueryResult } from '@/utils/queries/types';
import { Currency } from '@/utils/currencies';
import { ExpandTabRef } from '@/pages/case-management-item/UserCaseDetails';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';

export const FIXED_API_PARAMS = {
  afterTimestamp: 0,
  beforeTimestamp: Number.MAX_SAFE_INTEGER,
  sortField: 'timestamp',
  sortOrder: 'descend',
};

interface Props {
  userId: string;
  reference?: React.Ref<ExpandTabRef>;
  updateCollapseState?: (key: string, value: boolean) => void;
}

export default function InsightsCard(props: Props) {
  const { userId, updateCollapseState } = props;
  const [selectorParams, setSelectorParams] = useState<Params>({
    selectedRuleActions: [],
    displayBy: 'COUNT',
    transactionsCount: 'LAST_10',
    currency: 'USD',
  });

  const statsQueryResult = useStatsQuery(selectorParams, userId, selectorParams.currency);

  return (
    <Card.Root
      header={{ title: 'Transaction Insights', collapsedByDefault: true }}
      ref={props.reference}
      onCollapseChange={(isCollapsed) => {
        if (updateCollapseState) {
          updateCollapseState('insights', isCollapsed);
        }
      }}
    >
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

function useStatsQuery(
  selectorParams: Params,
  userId: string,
  referenceCurrency: Currency,
): QueryResult<TransactionsStatsByTypesResponseData[]> {
  const api = useApi();
  return useQuery(
    TRANSACTIONS_STATS('by-type', { ...selectorParams, referenceCurrency, userId }),
    async (): Promise<TransactionsStatsByTypesResponseData[]> => {
      let pageSize = DEFAULT_PAGE_SIZE;
      if (selectorParams.transactionsCount === 'LAST_10') {
        pageSize = 10;
      } else if (selectorParams.transactionsCount === 'LAST_50') {
        pageSize = 50;
      }

      const response = await api.getTransactionsStatsByType({
        ...FIXED_API_PARAMS,
        pageSize,
        filterUserId: userId,
        filterStatus: selectorParams.selectedRuleActions,
        referenceCurrency,
      });

      return response.data;
    },
  );
}
