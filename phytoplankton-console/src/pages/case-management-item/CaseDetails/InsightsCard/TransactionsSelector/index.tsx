import React from 'react';
import cn from 'clsx';
import { Select } from 'antd';
import { RangeValue } from 'rc-picker/lib/interface';
import { CURRENCIES_SELECT_OPTIONS, Currency } from '@flagright/lib/constants';
import TransactionCountChart from './Chart';
import s from './styles.module.less';
import SwitchButton from './SwitchButton';
import { TRANSACTION_STATE_COLORS } from './Chart/Column';
import ContainerWidthMeasure from '@/components/utils/ContainerWidthMeasure';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import * as Form from '@/components/ui/Form';
import { QueryResult } from '@/utils/queries/types';
import {
  TransactionState as LastTransactionState,
  RuleAction,
  TransactionsStatsByTimeResponseData,
} from '@/apis';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_STATS } from '@/utils/queries/keys';
import { FIXED_API_PARAMS } from '@/pages/case-management-item/CaseDetails/InsightsCard';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { PARTIAL_RULE_ACTIONS } from '@/pages/case-management-item/CaseDetails/InsightsCard/TransactionsSelector/Chart/types';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import { TRANSACTION_STATES } from '@/apis/models-custom/TransactionState';
import TransactionState from '@/components/ui/TransactionStateDisplay';
import { Dayjs } from '@/utils/dayjs';
import DatePicker from '@/components/ui/DatePicker';

export const DISPLAY_BY_OPTIONS = ['COUNT', 'AMOUNT'] as const;
export type DisplayByType = typeof DISPLAY_BY_OPTIONS[number];
export type AggregateByField = 'status' | 'transactionState';
export interface Params {
  selectedRuleActions?: RuleAction[];
  selectedTransactionStates?: LastTransactionState[];
  displayBy: DisplayByType;
  currency: Currency;
  transactionsCount: number;
  aggregateBy: AggregateByField;
  timeRange: RangeValue<Dayjs>;
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
  const selectedKeys =
    params.aggregateBy === 'status' ? params.selectedRuleActions : params.selectedTransactionStates;
  const options = params.aggregateBy === 'status' ? PARTIAL_RULE_ACTIONS : TRANSACTION_STATES;

  return (
    <div className={cn(s.root)}>
      <div className={s.header}>
        <div className={cn(s.buttons)}>
          <SwitchButton
            isActive={!selectedKeys?.length}
            onClick={() => {
              onChangeParams({
                ...params,
                selectedRuleActions: [],
                selectedTransactionStates: [],
              });
            }}
          >
            All
          </SwitchButton>
          {params.aggregateBy === 'status'
            ? PARTIAL_RULE_ACTIONS.map((option: RuleAction) => {
                const checked = params.selectedRuleActions?.indexOf(option) !== -1;
                return (
                  <SwitchButton
                    key={option}
                    isActive={checked}
                    onClick={() => {
                      onChangeParams({
                        ...params,
                        selectedRuleActions: [
                          ...(params.selectedRuleActions?.filter((x) => x != option) ?? []),
                          ...(checked ? [] : [option]),
                        ],
                        selectedTransactionStates: [],
                      });
                    }}
                  >
                    <RuleActionStatus ruleAction={option as RuleAction} isForChart />
                  </SwitchButton>
                );
              })
            : TRANSACTION_STATES.map((option: LastTransactionState) => {
                const checked = params.selectedTransactionStates?.indexOf(option) !== -1;
                return (
                  <SwitchButton
                    key={option}
                    isActive={checked}
                    onClick={() => {
                      onChangeParams({
                        ...params,
                        selectedRuleActions: [],
                        selectedTransactionStates: [
                          ...(params.selectedTransactionStates?.filter((x) => x != option) ?? []),
                          ...(checked ? [] : [option]),
                        ],
                      });
                    }}
                  >
                    <div className={s.transactionState}>
                      <div
                        className={s.marker}
                        style={{ backgroundColor: TRANSACTION_STATE_COLORS[option] }}
                      ></div>
                      <TransactionState transactionState={option as LastTransactionState} />
                    </div>
                  </SwitchButton>
                );
              })}
        </div>
        <div className={s.settings}>
          <DatePicker.RangePicker
            value={params.timeRange}
            onChange={(value) => {
              onChangeParams({ ...params, timeRange: value });
            }}
          />
          <Select<string>
            value={`${params.aggregateBy}`}
            onChange={(value) => {
              onChangeParams({
                ...params,
                aggregateBy: value as AggregateByField,
              });
            }}
            options={[
              { value: 'status', label: 'Transaction status' },
              { value: 'transactionState', label: 'Last transaction state' },
            ]}
          />
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
                    values: options
                      .map((category) => [
                        category,
                        x.values[category]?.[params.displayBy === 'COUNT' ? 'count' : 'amount'] ??
                          0,
                      ])
                      .reduce(
                        (acc, [category, value]) => ({ ...acc, [category]: value }),
                        options.reduce((acc, item) => {
                          acc[item] = 0;
                          return acc;
                        }, {} as { [key in RuleAction | LastTransactionState]: number }),
                      ),
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
  return useQuery(
    TRANSACTIONS_STATS('by-date', {
      ...selectorParams,
      userId,
      currency,
      aggregateBy: selectorParams.aggregateBy,
    }),
    async (): Promise<TransactionsStatsByTimeResponseData[]> => {
      const response = await api.getTransactionsStatsByTime({
        ...FIXED_API_PARAMS,
        pageSize: selectorParams.transactionsCount,
        filterUserId: userId,
        filterStatus: selectorParams.selectedRuleActions,
        filterTransactionState: selectorParams.selectedTransactionStates,
        referenceCurrency: currency,
        aggregateBy: selectorParams.aggregateBy,
        afterTimestamp: selectorParams.timeRange?.[0]?.valueOf(),
        beforeTimestamp: selectorParams.timeRange?.[1]?.valueOf(),
      });

      return response.data;
    },
  );
}
