/* eslint-disable @typescript-eslint/no-var-requires */
import { useState } from 'react';
import { RangeValue } from 'rc-picker/lib/interface';
import { Link } from 'react-router-dom';
import DatePicker from '@/components/ui/DatePicker';
import { Dayjs, dayjs } from '@/utils/dayjs';
import { DashboardStatsRulesCountData } from '@/apis';
import { useApi } from '@/api';
import { makeUrl } from '@/utils/routing';
import { getRuleInstanceDisplay, getRuleInstanceDisplayId } from '@/pages/rules/utils';
import { TableColumn } from '@/components/library/Table/types';
import { useRules } from '@/utils/rules';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { HITS_PER_USER_STATS } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';

export default function RuleHitCard() {
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'week'),
    dayjs(),
  ]);
  const { rules, ruleInstances } = useRules();

  const helper = new ColumnHelper<DashboardStatsRulesCountData>();
  const columns: TableColumn<DashboardStatsRulesCountData>[] = helper.list([
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
      title: 'Rules hit',
      key: 'hitCount',
    }),
    helper.simple<'openCasesCount'>({
      title: 'Open cases',
      key: 'openCasesCount',
      type: {
        render: (openCasesCount, { item }) => {
          let startTimestamp;
          let endTimestamp;
          const [start, end] = dateRange ?? [];
          if (start != null && end != null) {
            startTimestamp = start.startOf('day').valueOf();
            endTimestamp = end.endOf('day').valueOf();
          }
          return (
            <>
              <Link
                to={makeUrl(
                  '/case-management/cases',
                  {},
                  {
                    rulesHitFilter: item.ruleInstanceId,
                    createdTimestamp: `${startTimestamp},${endTimestamp}`,
                  },
                )}
              >
                {openCasesCount} Cases
              </Link>
            </>
          );
        },
      },
    }),
  ]);

  const rulesHitResult = usePaginatedQuery(
    HITS_PER_USER_STATS(dateRange),
    async (paginationParams) => {
      let startTimestamp = dayjs().subtract(1, 'day').valueOf();
      let endTimestamp = Date.now();

      const [start, end] = dateRange ?? [];
      if (start != null && end != null) {
        startTimestamp = start.startOf('day').valueOf();
        endTimestamp = end.endOf('day').valueOf();
      }
      const result = await api.getDashboardStatsRuleHit({
        ...paginationParams,
        startTimestamp,
        endTimestamp,
      });

      return {
        total: result.data.length,
        items: result.data,
      };
    },
  );

  return (
    <QueryResultsTable<DashboardStatsRulesCountData>
      rowKey="ruleId"
      columns={columns}
      extraTools={[() => <DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
      queryResults={rulesHitResult}
      pagination={false}
      sizingMode="FULL_WIDTH"
      toolsOptions={{
        setting: false,
        reload: true,
      }}
    />
  );
}
