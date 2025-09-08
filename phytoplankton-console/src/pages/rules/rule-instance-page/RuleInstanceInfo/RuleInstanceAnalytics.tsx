import { useEffect, useMemo, useState, useCallback } from 'react';
import { isEqual, round } from 'lodash';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { FROZEN_STATUSES, isShadowRule as checkShadowRule } from '../../utils';
import s from './styles.module.less';
import Widget from '@/components/library/Widget';
import { RuleInstance } from '@/apis';
import { useApi } from '@/api';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { RULE_STATS, USERS } from '@/utils/queries/keys';
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
import { map, success } from '@/utils/asyncResource';
import WidgetGrid, { WidgetGroupItem } from '@/components/library/WidgetGrid';
import { UsersTable } from '@/pages/users/users-list/users-table';
import {
  COLORS_V2_ALERT_WARNING,
  COLORS_V2_ANALYTICS_CHARTS_06,
  COLORS_V2_ANALYTICS_CHARTS_10,
} from '@/components/ui/colors';
import { makeUrl } from '@/utils/routing';
import { dayjs } from '@/utils/dayjs';
import LineChart from '@/components/charts/Line';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useTransactionsQuery } from '@/pages/transactions/utils';

const HIT_RATE_SERIES = 'Hit rate';
const FALSE_POSITIVE_RATE_SERIES = 'False positive rate';

type TimeRange = { afterTimestamp?: number; beforeTimestamp?: number };

const DEFAULT_TIME_RANGE = {
  startTimestamp: dayjs().subtract(2, 'week').valueOf(),
  endTimestamp: dayjs().valueOf(),
};

const ALL_STATUS = [
  'OPEN',
  'ESCALATED',
  'CLOSED',
  ...Object.entries(FROZEN_STATUSES).map(([_key, value]) => value.value),
];

export const RuleInstanceAnalytics = (props: { ruleInstance: RuleInstance }) => {
  const { ruleInstance } = props;
  const api = useApi();
  const [timeRange, setTimeRange] = useState<WidgetRangePickerValue>(DEFAULT_TIME_RANGE);
  const settings = useSettings();

  const handleDateReset = useCallback(() => {
    setTimeRange({
      startTimestamp: ruleInstance.createdAt,
      endTimestamp: dayjs().valueOf(),
    });
  }, [ruleInstance.createdAt]);

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
  const isShadowRule = checkShadowRule(ruleInstance);
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
                  } else {
                    handleDateReset();
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
                      hyperlink: makeUrl(
                        '/transactions/list',
                        {},
                        {
                          ruleInstancesHitFilter: ruleInstance.id,
                          timestamp: `${timeRange.startTimestamp},${timeRange.endTimestamp}`,
                        },
                      ),
                    },
                  ]}
                />
              )}
              <OverviewCard
                sections={[
                  {
                    title: isShadowRule ? 'Estimated alerts created' : 'Alerts created',
                    value: map(dataRes, (data) => data.alertsHit ?? 0),
                    hyperlink: isShadowRule
                      ? undefined
                      : makeUrl(
                          '/case-management/cases',
                          {},
                          {
                            showCases: 'ALL_ALERTS',
                            rulesHitFilter: ruleInstance.id,
                            createdTimestamp: `${timeRange.startTimestamp},${timeRange.endTimestamp}`,
                            alertStatus: ALL_STATUS.join(','),
                          },
                        ),
                  },
                ]}
              />
              <OverviewCard
                sections={[
                  {
                    title: `${firstLetterUpper(settings.userAlias)}s hit`,
                    value: map(dataRes, (data) => data.usersHit ?? 0),
                  },
                ]}
              />
              <OverviewCard
                sections={[
                  {
                    title: isShadowRule
                      ? 'Estimated avg investigation time'
                      : 'Avg alert investigation time',
                    value: map(dataRes, (data) =>
                      data.usersHit > 0 && data.investigationTime
                        ? formatDuration(getDuration(data.investigationTime))
                        : '-',
                    ),
                    toolTipInfo:
                      "Alert investigation time is calculated only when the alert status is changed to 'In progress'",
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
        <Widget title={isShadowRule ? 'Rule hit rate' : 'Rule hit rate and False positive rate'}>
          <AsyncResourceRenderer resource={analyticsQueryResult.data}>
            {(stats) => {
              const executionStats = stats.executionStats.map((v) => ({
                xValue: v.date,
                yValue: v.runCount ? round(((v.hitCount ?? 0) / v.runCount) * 100, 2) : 0,
                series: HIT_RATE_SERIES,
              }));
              const falsePositiveStats =
                stats.alertsStats?.map((v) => ({
                  xValue: v.date,
                  yValue: v.alertsCreated
                    ? round(((v.falsePositiveAlerts ?? 0) / v.alertsCreated) * 100, 2)
                    : 0,
                  series: FALSE_POSITIVE_RATE_SERIES,
                })) ?? [];
              const ruleInstanceUpdateStats = stats.ruleInstanceUpdateStats ?? [];
              const verticalLines = ruleInstanceUpdateStats.map((date) => ({
                xValue: date,
                color: COLORS_V2_ALERT_WARNING,
                label: 'Rule is edited',
              }));
              const colors = {
                [HIT_RATE_SERIES]: COLORS_V2_ANALYTICS_CHARTS_06,
                [FALSE_POSITIVE_RATE_SERIES]: COLORS_V2_ANALYTICS_CHARTS_10,
              };
              return (
                <LineChart
                  data={success([...executionStats, ...falsePositiveStats])}
                  colors={colors}
                  height={275}
                  hideLegend
                  formatY={(value) => `${value}%`}
                  verticalLines={verticalLines}
                />
              );
            }}
          </AsyncResourceRenderer>
        </Widget>
      ),
    },
  ];
  // Only show transaction and user hit tables for shadow rules for now
  if (isShadowRule && ruleInstance.type === 'TRANSACTION') {
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
        <Widget title={`${firstLetterUpper(settings.userAlias)}s hit`}>
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
  } else if (isShadowRule && ruleInstance.type === 'USER') {
    items.push({
      renderComponent: () => (
        <Widget title={`${firstLetterUpper(settings.userAlias)}s hit`}>
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

  useEffect(() => {
    if (!isEqual(params.timestamp, timestamp)) {
      setParams({
        ...params,
        timestamp,
      });
    }
  }, [params, timestamp]);

  const { queryResult, countQueryResult } = useTransactionsQuery(
    {
      ...params,
      filterShadowHit: checkShadowRule(ruleInstance),
      ruleInstancesHitFilter: [ruleInstance.id as string],
    },
    {
      isReadyToFetch: true,
    },
  );

  return (
    <TransactionsTable
      queryResult={queryResult}
      countQueryResult={countQueryResult}
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
    sort: [['timestamp', 'ascend']],
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
  const queryResult = usePaginatedQuery(queryKey, async (paginationParams) => {
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
      ...paginationParams,
      pageSize,
      afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
      beforeTimestamp: createdTimestamp ? dayjs(createdTimestamp[1]).valueOf() : undefined,
      filterId: userId,
      filterTagKey: tagKey,
      filterTagValue: tagValue,
      filterRiskLevel: riskLevels,
      sortField: sort[0]?.[0] ?? 'createdTimestamp',
      sortOrder: sort[0]?.[1] ?? 'ascend',
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
    sort: [['timestamp', 'ascend']],
  });
  const api = useApi();

  const queryKey = USERS('ALL', {
    ...params,
    ...timeRange,
    ruleInstanceId: ruleInstance.id,
    type: 'TRANSACTION_USERS_HIT',
    isShadowHit: true,
  });

  const queryResult = usePaginatedQuery(queryKey, async (paginationParams) => {
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
      ...paginationParams,
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
      sortOrder: sort[0]?.[1] ?? 'ascend',
      filterRiskLevelLocked: riskLevelLocked,
      ruleInstanceId: ruleInstance.id as string,
      filterShadowHit: checkShadowRule(ruleInstance),
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
