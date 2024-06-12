import { useEffect, useMemo, useState } from 'react';
import { isEqual, round } from 'lodash';
import { isShadowRule } from '../../utils';
import s from './styles.module.less';
import Widget from '@/components/library/Widget';
import { RuleInstance } from '@/apis';
import { dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import TransactionsTable, {
  transactionParamsToRequest,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { useCursorQuery, useQuery } from '@/utils/queries/hooks';
import { RULE_STATS, TRANSACTIONS_LIST, USERS } from '@/utils/queries/keys';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { H4 } from '@/components/ui/Typography';
import { UserSearchParams } from '@/pages/users/users-list';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import WidgetBase from '@/components/library/Widget/WidgetBase';
import { OverviewCard } from '@/pages/dashboard/analysis/components/widgets/OverviewCard';
import { formatDuration, getDuration } from '@/utils/time-utils';
import WidgetRangePicker, {
  Value as WidgetRangePickerValue,
} from '@/pages/dashboard/analysis/components/widgets/WidgetRangePicker';
import { map } from '@/utils/asyncResource';
import { LineChart } from '@/pages/dashboard/analysis/components/charts/Line';
import WidgetGrid, { WidgetGroupItem } from '@/components/library/WidgetGrid';
import { UsersTable } from '@/pages/users/users-list/users-table';
import { COLORS_V2_ANALYTICS_CHARTS_01 } from '@/components/ui/colors';

const HIT_RATE_SERIES = 'Hit rate (%)';
type TimeRange = { afterTimestamp?: number; beforeTimestamp?: number };
const DEFAULT_TIME_RANGE = {
  startTimestamp: dayjs().subtract(2, 'week').valueOf(),
  endTimestamp: dayjs().valueOf(),
};

export const RuleInstanceAnalytics = (props: { ruleInstance: RuleInstance }) => {
  const { ruleInstance } = props;
  const api = useApi();

  const [timeRange, setTimeRange] = useState<WidgetRangePickerValue>(DEFAULT_TIME_RANGE);

  const analyticsQueryResult = useQuery(
    RULE_STATS({ ...timeRange, ruleInstanceId: ruleInstance.id }),
    () => {
      return api.getRuleInstancesRuleInstanceIdStats({
        ruleInstanceId: ruleInstance.id as string,
        afterTimestamp: timeRange.startTimestamp ?? DEFAULT_TIME_RANGE.startTimestamp,
        beforeTimestamp: timeRange.endTimestamp ?? DEFAULT_TIME_RANGE.endTimestamp,
      });
    },
  );

  const dataRes = analyticsQueryResult.data;
  const items: WidgetGroupItem[] = [
    {
      renderComponent: () => (
        <WidgetBase width="FULL">
          <div className={s.analytics}>
            <div className={s.analyticsHeader}>
              <div>
                <H4>Analytics</H4>
              </div>
              <WidgetRangePicker
                value={timeRange}
                onChange={(timeRange) => {
                  if (timeRange) {
                    setTimeRange(timeRange);
                  }
                }}
              />
            </div>
            <div className={s.analyticsCard}>
              {ruleInstance.type === 'TRANSACTION' && (
                <OverviewCard
                  sections={[
                    {
                      title: 'Transactions hit',
                      value: map(dataRes, (data) => data.transactionsHit ?? 0),
                    },
                  ]}
                />
              )}
              <OverviewCard
                sections={[
                  {
                    title: 'Users hit',
                    value: map(dataRes, (data) => data.usersHit ?? 0),
                  },
                ]}
              />
              <OverviewCard
                sections={[
                  {
                    title: isShadowRule(ruleInstance)
                      ? 'Estimated alerts created'
                      : 'Alerts created',
                    value: map(dataRes, (data) => data.alertsHit ?? 0),
                  },
                ]}
              />
              <OverviewCard
                sections={[
                  {
                    title: isShadowRule(ruleInstance)
                      ? 'Estimated avg investigation time'
                      : 'Avg investigation time',
                    value: map(dataRes, (data) =>
                      data.usersHit > 0 && data.investigationTime
                        ? formatDuration(getDuration(data.investigationTime))
                        : '-',
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </WidgetBase>
      ),
    },
    {
      renderComponent: () => (
        <Widget title="Rule hit rate (%)">
          <AsyncResourceRenderer resource={analyticsQueryResult.data}>
            {(stats) => (
              <LineChart
                data={stats.executionStats.map((v) => ({
                  xValue: v.date,
                  yValue: v.runCount ? round(((v.hitCount ?? 0) / v.runCount) * 100, 2) : 0,
                  series: HIT_RATE_SERIES,
                }))}
                colors={{
                  [HIT_RATE_SERIES]: COLORS_V2_ANALYTICS_CHARTS_01,
                }}
                height={200}
                hideLegend={true}
              />
            )}
          </AsyncResourceRenderer>
        </Widget>
      ),
    },
  ];
  // Only show transaction and user hit tables for shadow rules for now
  if (isShadowRule(ruleInstance) && ruleInstance.type === 'TRANSACTION') {
    items.push({
      renderComponent: () => (
        <Widget title="Transactions hit">
          <HitTransactionTable
            ruleInstance={ruleInstance}
            timeRange={{
              afterTimestamp: timeRange.startTimestamp,
              beforeTimestamp: timeRange.endTimestamp,
            }}
          />
        </Widget>
      ),
    });
    items.push({
      renderComponent: () => (
        <Widget title="Users hit">
          <HitTransactionUsersTable
            ruleInstance={ruleInstance}
            timeRange={{
              afterTimestamp: timeRange.startTimestamp,
              beforeTimestamp: timeRange.endTimestamp,
            }}
          />
        </Widget>
      ),
    });
  } else if (isShadowRule(ruleInstance) && ruleInstance.type === 'USER') {
    items.push({
      renderComponent: () => (
        <Widget title="Users hit">
          <HitUsersTable
            ruleInstance={ruleInstance}
            timeRange={{
              afterTimestamp: timeRange.startTimestamp,
              beforeTimestamp: timeRange.endTimestamp,
            }}
          />
        </Widget>
      ),
    });
  }

  return (
    <WidgetGrid
      groups={[
        {
          groupTitle: '',
          items,
        },
      ]}
    />
  );
};

const HitTransactionTable = (props: { ruleInstance: RuleInstance; timeRange: TimeRange }) => {
  const { ruleInstance, timeRange } = props;
  const timestamp = useMemo(
    () => [
      dayjs(timeRange.afterTimestamp).toISOString(),
      dayjs(timeRange.beforeTimestamp).toISOString(),
    ],
    [timeRange],
  );
  const [params, setParams] = useState<TransactionsTableParams>({
    ...DEFAULT_PARAMS_STATE,
    pageSize: 10,
    sort: [['timestamp', 'descend']],
    timestamp,
  });
  const api = useApi();
  const queryKey = TRANSACTIONS_LIST({
    ...params,
    ruleInstanceId: ruleInstance.id,
    isShadowHit: true,
  });
  useEffect(() => {
    if (!isEqual(params.timestamp, timestamp)) {
      setParams({
        ...params,
        timestamp,
      });
    }
  }, [params, timestamp]);

  const queryResult = useCursorQuery(queryKey, async ({ from }) => {
    return await api.getTransactionsList({
      ...transactionParamsToRequest(params),
      start: from,
      filterShadowHit: isShadowRule(ruleInstance),
      filterRuleInstancesHit: [ruleInstance.id as string],
    });
  });

  return (
    <TransactionsTable
      queryResult={queryResult}
      params={params}
      onChangeParams={setParams}
      isExpandable={false}
    />
  );
};

const HitUsersTable = (props: { ruleInstance: RuleInstance; timeRange: TimeRange }) => {
  const { ruleInstance, timeRange } = props;
  const createdTimestamp = useMemo(
    () => [
      dayjs(timeRange.afterTimestamp).toISOString(),
      dayjs(timeRange.beforeTimestamp).toISOString(),
    ],
    [timeRange],
  );
  const [params, setParams] = useState<UserSearchParams>({
    ...DEFAULT_PARAMS_STATE,
    pageSize: 10,
    sort: [['timestamp', 'descend']],
    createdTimestamp,
  });
  useEffect(() => {
    if (!isEqual(params.createdTimestamp, createdTimestamp)) {
      setParams({
        ...params,
        createdTimestamp,
      });
    }
  }, [params, createdTimestamp]);
  const api = useApi();
  const queryKey = USERS('ALL', { ...params, ruleInstanceId: ruleInstance.id, isShadowHit: true });
  const queryResult = useCursorQuery(queryKey, async ({ from }) => {
    const {
      pageSize,
      createdTimestamp,
      userId,
      tagKey,
      tagValue,
      riskLevels,
      sort,
      riskLevelLocked,
    } = params;

    return await api.getAllUsersList({
      start: from,
      pageSize,
      afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
      beforeTimestamp: createdTimestamp ? dayjs(createdTimestamp[1]).valueOf() : undefined,
      filterId: userId,
      filterTagKey: tagKey,
      filterTagValue: tagValue,
      filterRiskLevel: riskLevels,
      sortField: sort[0]?.[0] ?? 'createdTimestamp',
      sortOrder: sort[0]?.[1] ?? 'descend',
      filterRiskLevelLocked: riskLevelLocked,
      filterRuleInstancesHit: [ruleInstance.id as string],
      filterShadowHit: true,
    });
  });

  return (
    <UsersTable
      queryResults={queryResult}
      params={params}
      handleChangeParams={setParams}
      type="all"
    />
  );
};

const HitTransactionUsersTable = (props: { ruleInstance: RuleInstance; timeRange: TimeRange }) => {
  const { ruleInstance, timeRange } = props;

  const [params, setParams] = useState<UserSearchParams>({
    ...DEFAULT_PARAMS_STATE,
    pageSize: 10,
    sort: [['timestamp', 'descend']],
  });
  const api = useApi();

  const queryKey = USERS('ALL', {
    ...params,
    ...timeRange,
    ruleInstanceId: ruleInstance.id,
    type: 'TRANSACTION_USERS_HIT',
    isShadowHit: true,
  });

  const queryResult = useCursorQuery(queryKey, async ({ from }) => {
    const {
      pageSize,
      userId,
      tagKey,
      tagValue,
      riskLevels,
      sort,
      riskLevelLocked,
      createdTimestamp,
    } = params;

    return await api.getRuleInstancesTransactionUsersHit({
      start: from,
      pageSize,
      txAfterTimestamp: timeRange.afterTimestamp,
      txBeforeTimestamp: timeRange.beforeTimestamp,
      afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
      beforeTimestamp: createdTimestamp ? dayjs(createdTimestamp[1]).valueOf() : undefined,
      filterId: userId,
      filterTagKey: tagKey,
      filterTagValue: tagValue,
      filterRiskLevel: riskLevels,
      sortField: sort[0]?.[0] ?? 'createdTimestamp',
      sortOrder: sort[0]?.[1] ?? 'descend',
      filterRiskLevelLocked: riskLevelLocked,
      ruleInstanceId: ruleInstance.id as string,
      filterShadowHit: isShadowRule(ruleInstance),
    });
  });

  return (
    <UsersTable
      queryResults={queryResult}
      params={params}
      handleChangeParams={setParams}
      type="all"
    />
  );
};
