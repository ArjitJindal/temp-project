/* eslint-disable @typescript-eslint/no-var-requires */
import { useState } from 'react';
import { RangeValue } from 'rc-picker/lib/interface';
import { Link } from 'react-router-dom';
import pluralize from 'pluralize';
import { generateAlertsListUrl } from '../HitsPerUserCard/utils';
import DatePicker from '@/components/ui/DatePicker';
import { Dayjs, dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { getRuleInstanceDisplay, getRuleInstanceDisplayId } from '@/pages/rules/utils';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { useRules } from '@/utils/rules';
import { useQuery } from '@/utils/queries/hooks';
import { RULES_HIT_STATS } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DashboardStatsRulesCount } from '@/apis';

export default function RuleHitCard() {
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

  const rulesHitResult = useQuery(
    RULES_HIT_STATS(dateRange, paginationParams.page, paginationParams.pageSize),
    async () => {
      const [start, end] = dateRange ?? [];
      const startTimestamp = start?.startOf('day').valueOf();
      const endTimestamp = end?.endOf('day').valueOf();

      const result = await api.getDashboardStatsRuleHit({
        startTimestamp,
        endTimestamp,
        pageSize: paginationParams.pageSize,
        page: paginationParams.page,
      });

      return {
        items: result.data,
        total: result.total,
      };
    },
  );

  return (
    <QueryResultsTable<DashboardStatsRulesCount>
      rowKey="ruleInstanceId"
      columns={columns}
      extraTools={[() => <DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
      queryResults={rulesHitResult}
      pagination={true}
      params={paginationParams}
      onChangeParams={setPaginationParams}
      sizingMode="FULL_WIDTH"
      toolsOptions={{
        setting: false,
        reload: true,
      }}
    />
  );
}
