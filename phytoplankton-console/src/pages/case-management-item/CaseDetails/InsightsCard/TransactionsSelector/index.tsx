import cn from 'clsx';
import { RangeValue } from 'rc-picker/lib/interface';
import { CURRENCIES_SELECT_OPTIONS, Currency } from '@flagright/lib/constants';
import TransactionCountChart from './Chart';
import s from './styles.module.less';
import SwitchButton from './SwitchButton';
import { TRANSACTION_STATE_COLORS } from './Chart/Column';
import ContainerWidthMeasure from '@/components/utils/ContainerWidthMeasure';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import * as Form from '@/components/ui/Form';
import { TransactionState as LastTransactionState, RuleAction } from '@/apis';
import { useTransactionsStatsByTime } from '@/hooks/api/transactions';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { PARTIAL_RULE_ACTIONS } from '@/pages/case-management-item/CaseDetails/InsightsCard/TransactionsSelector/Chart/types';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';
import { TRANSACTION_STATES } from '@/apis/models-custom/TransactionState';
import TransactionState from '@/components/ui/TransactionStateDisplay';
import { Dayjs } from '@/utils/dayjs';
import DatePicker from '@/components/ui/DatePicker';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import Select from '@/components/library/Select';

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
  const response = useTransactionsStatsByTime({ selectorParams: params, userId, currency });
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
          <Feature name="NEW_FEATURES">
            <DatePicker.RangePicker
              value={params.timeRange}
              onChange={(value) => {
                onChangeParams({ ...params, timeRange: value });
              }}
            />
          </Feature>
          <Select<string>
            mode="SINGLE"
            value={`${params.aggregateBy}`}
            onChange={(value) => {
              if (value) {
                onChangeParams({
                  ...params,
                  aggregateBy: value as AggregateByField,
                });
              }
            }}
            options={[
              { value: 'status', label: 'Transaction status' },
              { value: 'transactionState', label: 'Last transaction state' },
            ]}
          />
          <Select<string>
            mode="SINGLE"
            value={`${params.transactionsCount}`}
            onChange={(value) => {
              if (value) {
                onChangeParams({
                  ...params,
                  transactionsCount: parseInt(value) || 10,
                });
              }
            }}
            options={[
              { value: '10', label: 'Last 10 transactions' },
              { value: '50', label: 'Last 50 transactions' },
              { value: '1000', label: 'Last 1000 transactions' },
            ]}
          />
          <Form.Layout.Label title="Display by" orientation="horizontal">
            <Select<DisplayByType>
              mode="SINGLE"
              value={params.displayBy}
              onChange={(value) => {
                if (value) {
                  onChangeParams({
                    ...params,
                    displayBy: value,
                  });
                }
              }}
              options={[
                { value: 'COUNT', label: 'Transaction count' },
                { value: 'AMOUNT', label: 'Transaction amount' },
              ]}
            />
          </Form.Layout.Label>
          <Form.Layout.Label title="Currency" orientation="horizontal">
            <Select<Currency>
              mode="SINGLE"
              value={params.currency}
              onChange={(value) => {
                if (value) {
                  onChangeParams({
                    ...params,
                    currency: value,
                  });
                }
              }}
              options={CURRENCIES_SELECT_OPTIONS}
              onSearch={() => {}}
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

// moved to hooks/api/transactions.ts
