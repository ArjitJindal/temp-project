/* eslint-disable @typescript-eslint/no-var-requires */
import { useState } from 'react';
import { RangeValue } from 'rc-picker/lib/interface';
import { Link } from 'react-router-dom';
import pluralize from 'pluralize';
import { generateAlertsListUrl } from '../HitsPerUserCard/utils';
import s from './style.module.less';
import Tooltip from '@/components/library/Tooltip';
import DatePicker from '@/components/ui/DatePicker';
import { Dayjs, dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { getRuleInstanceDisplay, getRuleInstanceDisplayId } from '@/pages/rules/utils';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { useRules } from '@/utils/rules';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { RULES_HIT_STATS } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DashboardStatsRulesCount } from '@/apis';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { formatNumber } from '@/utils/number';
import RuleHitInsightsTag from '@/components/library/Tag/RuleHitInsightsTag';

export default function RuleHitCard(props: WidgetProps) {
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'week'),
    dayjs(),
  ]);
  const [paginationParams, setPaginationParams] = useState<CommonParams>({
    page: 1,
    pageSize: 10,
    sort: [],
  });
  const { rules, ruleInstances } = useRules();

  const helper = new ColumnHelper<DashboardStatsRulesCount>();
  const columns: TableColumn<DashboardStatsRulesCount>[] = helper.list([
    helper.derived<string>({
      title: 'Rule ID',
      value: (stat) => getRuleInstanceDisplayId(stat.ruleId, stat.ruleInstanceId),
    }),
    helper.derived<string>({
      title: 'Rule name',
      value: (stat) => {
        if (!stat.ruleInstanceId) {
          return stat.ruleId;
        }
        return getRuleInstanceDisplay(stat.ruleId, stat.ruleInstanceId, rules, ruleInstances);
      },
    }),
    helper.simple<'hitCount'>({
      title: 'Rule hits',
      key: 'hitCount',
    }),
    helper.derived<string>({
      id: 'runCount',
      title: 'Hit rate',
      value: (row) => {
        if (row.hitCount && row.runCount) {
          return `${((row.hitCount / row.runCount) * 100).toFixed(2)}%`;
        }
        return '0%';
      },
      sorting: true,
      type: {
        render: (_value, { item: ruleInstance }) => {
          const displayHitCount = formatNumber(ruleInstance.hitCount ?? 0);
          const displayRunCount = formatNumber(ruleInstance.runCount ?? 0);
          const percent =
            ruleInstance.hitCount && ruleInstance.runCount
              ? (ruleInstance.hitCount / ruleInstance.runCount) * 100
              : 0;
          return (
            <>
              <div className={s.tag}>
                <Tooltip title={<>{`Hit: ${displayHitCount} / Run: ${displayRunCount}`}</>}>
                  {(percent ?? 0.0)?.toFixed(2)}%
                </Tooltip>
                {percent > 10 && (
                  <RuleHitInsightsTag percentage={percent} runs={ruleInstance.runCount} />
                )}
              </div>
            </>
          );
        },
      },
    }),
    helper.simple<'openAlertsCount'>({
      title: 'Open alerts',
      key: 'openAlertsCount',
      type: {
        render: (openAlertsCount, { item }) => {
          return (
            <>
              <Link
                to={generateAlertsListUrl(
                  {
                    rulesHitFilter: item.ruleInstanceId,
                  },
                  'ALL',
                  dateRange,
                )}
              >
                {openAlertsCount} open {pluralize('alert', openAlertsCount)}
              </Link>
            </>
          );
        },
      },
    }),
  ]);

  const rulesHitResult = usePaginatedQuery(
    RULES_HIT_STATS(dateRange, paginationParams.page, paginationParams.pageSize),
    async (p) => {
      const [start, end] = dateRange ?? [];
      const startTimestamp = start?.startOf('day').valueOf();
      const endTimestamp = end?.endOf('day').valueOf();

      const result = await api.getDashboardStatsRuleHit({
        startTimestamp,
        endTimestamp,
        pageSize: p?.pageSize ?? paginationParams.pageSize,
        page: p?.page ?? paginationParams.page,
      });
      return {
        items: result.data,
        total: result.total,
      };
    },
  );

  return (
    <Widget {...props}>
      <QueryResultsTable<DashboardStatsRulesCount>
        rowKey="ruleInstanceId"
        columns={columns}
        externalHeader={true}
        extraTools={[() => <DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
        queryResults={rulesHitResult}
        pagination={true}
        params={paginationParams}
        onChangeParams={setPaginationParams}
        sizingMode="FULL_WIDTH"
        toolsOptions={{
          setting: false,
          reload: true,
          download: true,
        }}
      />
    </Widget>
  );
}
