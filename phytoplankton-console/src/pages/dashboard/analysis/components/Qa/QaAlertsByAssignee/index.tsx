import { RangeValue } from 'rc-picker/es/interface';
import React, { useState } from 'react';
import { BarChart } from '../../charts/BarChart';
import s from './styles.module.less';
import { getCsvData } from '@/pages/dashboard/analysis/utils/export-data-build-util';
import Widget from '@/components/library/Widget';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_STATS_QA_ALERTS_BY_ASSIGNEE } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { WidgetProps } from '@/components/library/Widget/types';
import { useUsers } from '@/utils/user-utils';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { DashboardStatsQaAlertsCountByAssigneeData } from '@/apis';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';

interface Props extends WidgetProps {}

const QaAlertsByAssignee = (props: Props) => {
  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'month'),
    dayjs(),
  ]);

  const api = useApi();

  const getStartAndEndTimestamp = (
    dateRange: RangeValue<Dayjs>,
  ): {
    startTimestamp: number;
    endTimestamp: number;
  } => {
    let startTimestamp = dayjs().subtract(1, 'month').valueOf();
    let endTimestamp = Date.now();

    const [start, end] = dateRange ?? [];
    if (start != null && end != null) {
      startTimestamp = start.startOf('day').valueOf();
      endTimestamp = end.endOf('day').valueOf();
    }
    return {
      startTimestamp,
      endTimestamp,
    };
  };

  const qaAlertsByAssignee = useQuery(
    DASHBOARD_STATS_QA_ALERTS_BY_ASSIGNEE(dateRange),
    async () => {
      const { startTimestamp, endTimestamp } = getStartAndEndTimestamp(dateRange);

      const result = await api.getDashboardStatsQaAlertsByAssignee({
        startTimestamp,
        endTimestamp,
      });

      return {
        total: result.data.length,
        items: result.data,
      };
    },
  );

  const [users] = useUsers();

  const getData = (items: DashboardStatsQaAlertsCountByAssigneeData[]) => {
    return items
      .map((item) => {
        const percentage = item.alertsAssignedForQa
          ? ((item.alertsQaedByAssignee / item.alertsAssignedForQa) * 100).toFixed(2)
          : '0';
        return {
          label: users?.[item.accountId]?.name ?? users?.[item.accountId]?.email ?? item.accountId,
          value: parseFloat(percentage),
          info: (
            <span>
              <span className={s.info}>{item.alertsQaedByAssignee} alerts QA'd </span>out of{' '}
              {item.alertsAssignedForQa}
            </span>
          ),
          valueLabel: `${percentage}%`,
        };
      })
      .sort((a, b) => b.value - a.value);
  };

  return (
    <AsyncResourceRenderer resource={qaAlertsByAssignee.data}>
      {({ items }) => {
        const dataToExport = items.map((item) => {
          return {
            accountId: `${item.accountId}`,
            name: users?.[item.accountId]?.name ?? users?.[item.accountId]?.email ?? item.accountId,
            alertsAssignedForQa: item.alertsAssignedForQa,
            alertsQAed: item.alertsQaedByAssignee,
          };
        });
        const data = getData(items);
        return (
          <Widget
            {...props}
            resizing="AUTO"
            width="FULL"
            extraControls={[<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
            onDownload={(): Promise<{ fileName: string; data: string }> => {
              return new Promise((resolve, _reject) => {
                const fileData = {
                  fileName: `qa-alerts-by-assignee-${dayjs().format('YYYY_MM_DD')}.csv`,
                  data: getCsvData(dataToExport),
                };
                resolve(fileData);
              });
            }}
          >
            {items.length === 0 ? (
              <NoData />
            ) : (
              <div className={s.root}>
                <div className={s.header}>
                  <span>Assignee</span>
                  <span>QA'd alerts</span>
                </div>
                <BarChart data={data} />
              </div>
            )}
          </Widget>
        );
      }}
    </AsyncResourceRenderer>
  );
};

export default QaAlertsByAssignee;
