import { RangeValue } from 'rc-picker/es/interface';
import React, { useMemo, useState } from 'react';
import { getCsvData } from '@/pages/dashboard/analysis/utils/export-data-build-util';
import Widget from '@/components/library/Widget';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { useQaAlertsByRuleHits } from '@/hooks/api/dashboard';
import { isSuccess } from '@/utils/asyncResource';
import { useRules } from '@/utils/rules';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { DashboardStatsQaAlertsCountByRuleData } from '@/apis/models/DashboardStatsQaAlertsCountByRuleData';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { TableColumn } from '@/components/library/Table/types';
import {
  getRuleInstanceDescription,
  getRuleInstanceDisplay,
  getRuleInstanceDisplayId,
} from '@/pages/rules/utils';
import { WidgetProps } from '@/components/library/Widget/types';
import Id from '@/components/ui/Id';

interface Props extends WidgetProps {}

const QaAlertsByRuleHits = (props: Props) => {
  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'month'),
    dayjs(),
  ]);

  const getStartAndEndTimestamp = (dateRange: RangeValue<Dayjs>) => {
    const [start, end] = dateRange ?? [];
    const startTimestamp = start?.startOf('day').valueOf();
    const endTimestamp = end?.endOf('day').valueOf();
    return {
      startTimestamp,
      endTimestamp,
    };
  };

  const qaAlertsByRuleHits = useQaAlertsByRuleHits(dateRange);

  const { ruleInstances, rules } = useRules();
  const dataToExport = useMemo(() => {
    if (isSuccess(qaAlertsByRuleHits.data)) {
      const data = qaAlertsByRuleHits.data.value.items.map((item) => {
        return {
          ruleId: `${item.ruleId} (${item.ruleInstanceId})`,
          ruleName: ruleInstances[item.ruleId]?.ruleNameAlias ?? rules[item.ruleId]?.name,
          ruleDescription:
            ruleInstances[item.ruleId]?.ruleDescriptionAlias ?? rules[item.ruleId]?.description,
          alertsCount: item.alertsCount,
        };
      });
      return data;
    }
    return [];
  }, [qaAlertsByRuleHits.data, ruleInstances, rules]);

  const helper = new ColumnHelper<DashboardStatsQaAlertsCountByRuleData>();
  const columns: TableColumn<DashboardStatsQaAlertsCountByRuleData>[] = helper.list([
    helper.derived<string>({
      title: 'Rule ID',
      value: (stat) => getRuleInstanceDisplayId(stat.ruleId, stat.ruleInstanceId),
      type: {
        render: (value, { item }) => (
          <Id to={`/rules/my-rules/${item.ruleInstanceId}/read`}>{value}</Id>
        ),
      },
    }),
    helper.derived<string>({
      title: 'Rule name',
      value: (stat) => {
        if (!stat.ruleInstanceId) {
          return stat.ruleId;
        }
        return getRuleInstanceDisplay(stat.ruleId, stat.ruleInstanceId, rules, ruleInstances);
      },
      defaultWidth: 250,
    }),
    helper.derived<string>({
      title: 'Rule description',
      value: (stat) => {
        if (!stat.ruleInstanceId) {
          return stat.ruleId;
        }
        return getRuleInstanceDescription(stat.ruleId, ruleInstances, rules);
      },
      defaultWidth: 400,
    }),
    helper.simple<'alertsCount'>({
      title: 'QA’d alerts',
      key: 'alertsCount',
    }),
    helper.display({
      title: ' ',
      render: ({ ruleInstanceId }) => {
        const { startTimestamp, endTimestamp } = getStartAndEndTimestamp(dateRange);
        return (
          <Id
            to={`/case-management/cases?page=1&pageSize=20&showCases=ALL_ALERTS&rulesHitFilter=${ruleInstanceId}&updatedAt=${startTimestamp}%2C${endTimestamp}`}
          >
            View alerts
          </Id>
        );
      },
    }),
  ]);
  return (
    <Widget
      {...props}
      resizing="AUTO"
      extraControls={[
        <DatePicker.RangePicker
          value={dateRange}
          onChange={setDateRange}
          key="date-picker-range"
        />,
      ]}
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `qa-alerts-by-rule-hit-${dayjs().format('YYYY_MM_DD')}.csv`,
            data: getCsvData(dataToExport),
          };
          resolve(fileData);
        });
      }}
    >
      <QueryResultsTable<DashboardStatsQaAlertsCountByRuleData>
        rowKey="ruleId"
        columns={columns}
        queryResults={qaAlertsByRuleHits}
        pagination={false}
        sizingMode="SCROLL"
        toolsOptions={{
          setting: false,
          download: false,
          reload: false,
        }}
        fitHeight={300}
        externalHeader={true}
      />
    </Widget>
  );
};

export default QaAlertsByRuleHits;
