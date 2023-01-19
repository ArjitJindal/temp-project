import React from 'react';
import cn from 'clsx';
import { Select } from 'antd';
import TransactionCountChart from './Chart';
import s from './styles.module.less';
import SwitchButton from './SwitchButton';
import ContainerWidthMeasure from '@/components/utils/ContainerWidthMeasure';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { RuleAction } from '@/apis/models/RuleAction';
import * as Form from '@/components/ui/Form';
import { QueryResult } from '@/utils/queries/types';
import { TransactionsStatsByTimeResponseData } from '@/apis';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_STATS } from '@/utils/queries/keys';
import { FIXED_API_PARAMS } from '@/pages/case-management-item/UserCaseDetails/InsightsCard';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { CURRENCIES_SELECT_OPTIONS, Currency } from '@/utils/currencies';
import { PARTIAL_RULE_ACTIONS } from '@/pages/case-management-item/UserCaseDetails/InsightsCard/TransactionsSelector/Chart/types';
import NoData from '@/pages/case-management-item/UserCaseDetails/InsightsCard/components/NoData';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import { useApiTime } from '@/utils/tracker';

export const DISPLAY_BY_OPTIONS = ['COUNT', 'AMOUNT'] as const;
export type DisplayByType = typeof DISPLAY_BY_OPTIONS[number];

export interface Params {
  selectedRuleActions: RuleAction[];
  displayBy: DisplayByType;
  currency: Currency;
  transactionsCount: number;
}

interface Props {
  userId: string;
  params: Params;
  onChangeParams: (params: Params) => void;
  currency: Currency;
}

export default function TransactionsSelector(props: Props) {
  const { userId, params, onChangeParams, currency } = props;

  const response = useStatsQuery(params, userId, currency);

  return (
    <div className={cn(s.root)}>
      <div className={s.header}>
        <div className={cn(s.buttons)}>
          <SwitchButton
            isActive={params.selectedRuleActions.length === 0}
            onClick={() => {
              onChangeParams({
                ...params,
                selectedRuleActions: [],
              });
            }}
          >
            All
          </SwitchButton>
          {PARTIAL_RULE_ACTIONS.map((ruleAction) => {
            const checked = params.selectedRuleActions.indexOf(ruleAction) !== -1;
            return (
              <SwitchButton
                key={ruleAction}
                isActive={checked}
                onClick={() => {
                  onChangeParams({
                    ...params,
                    selectedRuleActions: [
                      ...params.selectedRuleActions.filter((x) => x != ruleAction),
                      ...(checked ? [] : [ruleAction]),
                    ],
                  });
                }}
              >
                <RuleActionStatus ruleAction={ruleAction} />
              </SwitchButton>
            );
          })}
        </div>
        <div className={s.settings}>
          <Select<string>
            value={`${params.transactionsCount}`}
            onChange={(value) => {
              onChangeParams({
                ...params,
                transactionsCount: parseInt(value) || DEFAULT_PAGE_SIZE,
              });
            }}
            options={[
              { value: '10', label: 'Last 10 transactions' },
              { value: '50', label: 'Last 50 transactions' },
              { value: '1000', label: 'Last 1000 transactions' },
            ]}
          />
          <Form.Layout.Label title="Display by" orientation="horizontal">
            <Select<DisplayByType>
              value={params.displayBy}
              onChange={(value) => {
                onChangeParams({
                  ...params,
                  displayBy: value,
                });
              }}
              options={[
                { value: 'COUNT', label: 'Transaction count' },
                { value: 'AMOUNT', label: 'Transaction amount' },
              ]}
              style={{ width: '200px' }}
            />
          </Form.Layout.Label>
          <Form.Layout.Label title="Currency" orientation="horizontal">
            <Select<Currency>
              value={params.currency}
              onChange={(value) => {
                onChangeParams({
                  ...params,
                  currency: value,
                });
              }}
              options={CURRENCIES_SELECT_OPTIONS}
              showSearch
              style={{ width: '200px' }}
            />
          </Form.Layout.Label>
        </div>
      </div>
      <ContainerWidthMeasure>
        {(width) => (
          <AsyncResourceRenderer resource={response.data}>
            {(data) => {
              if (data.length === 0) {
                return <NoData />;
              }
              return (
                <TransactionCountChart
                  currency={params.displayBy === 'AMOUNT' ? currency : null}
                  seriesList={data.map(({ series, label }) => ({ name: series, label }))}
                  settings={{
                    width: width,
                    height: 400,
                  }}
                  data={data.map((x) => ({
                    series: x.series,
                    values: PARTIAL_RULE_ACTIONS.map((category) => [
                      category,
                      x.values[category]?.[params.displayBy === 'COUNT' ? 'count' : 'amount'] ?? 0,
                    ]).reduce((acc, [category, value]) => ({ ...acc, [category]: value }), {
                      ALLOW: 0,
                      FLAG: 0,
                      BLOCK: 0,
                      SUSPEND: 0,
                    }),
                  }))}
                />
              );
            }}
          </AsyncResourceRenderer>
        )}
      </ContainerWidthMeasure>
    </div>
  );
}

function useStatsQuery(
  selectorParams: Params,
  userId: string,
  currency: Currency,
): QueryResult<TransactionsStatsByTimeResponseData[]> {
  const api = useApi();
  const measure = useApiTime();
  return useQuery(
    TRANSACTIONS_STATS('by-date', { ...selectorParams, userId, currency }),
    async (): Promise<TransactionsStatsByTimeResponseData[]> => {
      const response = await measure(
        () =>
          api.getTransactionsStatsByTime({
            ...FIXED_API_PARAMS,
            pageSize: selectorParams.transactionsCount,
            filterUserId: userId,
            filterStatus: selectorParams.selectedRuleActions,
            referenceCurrency: currency,
          }),
        'Transaction Stats By Time',
      );

      return response.data;
    },
  );
}
