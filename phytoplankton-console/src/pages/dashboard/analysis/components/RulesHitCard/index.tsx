/* eslint-disable @typescript-eslint/no-var-requires */
import { useState } from 'react';
import { RangeValue } from 'rc-picker/lib/interface';
import { Link } from 'react-router-dom';
import pluralize from 'pluralize';
import { generateAlertsListUrl } from '../HitsPerUserCard/utils';
import DatePicker from '@/components/ui/DatePicker';
import { Dayjs, dayjs } from '@/utils/dayjs';
import { DashboardStatsRulesCountData } from '@/apis';
import { useApi } from '@/api';
import { getRuleInstanceDisplay, getRuleInstanceDisplayId } from '@/pages/rules/utils';
import { TableColumn } from '@/components/library/Table/types';
import { useRules } from '@/utils/rules';
import { useQuery } from '@/utils/queries/hooks';
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

  const rulesHitResult = useQuery(HITS_PER_USER_STATS(dateRange), async () => {
    const [start, end] = dateRange ?? [];
    const startTimestamp = start?.startOf('day').valueOf();
    const endTimestamp = end?.endOf('day').valueOf();

    const result = await api.getDashboardStatsRuleHit({
      startTimestamp,
      endTimestamp,
    });

    return {
      total: result.data.length,
      items: result.data,
    };
  });

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
