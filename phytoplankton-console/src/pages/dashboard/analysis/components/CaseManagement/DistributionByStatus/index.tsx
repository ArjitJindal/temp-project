/* eslint-disable @typescript-eslint/no-var-requires */
import { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { Empty } from 'antd';
import { useLocalStorageState } from 'ahooks';
import ScopeSelector from '../CaseClosingReasonCard/ScopeSelector';
import { formatDate } from '../../../utils/date-utils';
import GranularDatePicker, {
  DEFAULT_DATE_RANGE,
  GranularityValuesType,
  granularityValues,
  timeframe,
} from '../../widgets/GranularDatePicker/GranularDatePicker';
import s from './index.module.less';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { map } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TRANSACTIONS_STATS } from '@/utils/queries/keys';
import Column, { ColumnData } from '@/pages/dashboard/analysis/components/charts/Column';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_03,
  COLORS_V2_ANALYTICS_CHARTS_04,
  COLORS_V2_ANALYTICS_CHARTS_06,
  COLORS_V2_ANALYTICS_CHARTS_08,
} from '@/components/ui/colors';
import { humanizeSnakeCase } from '@/utils/humanize';
type statusType = 'OPEN' | 'CLOSED' | 'REOPENED' | 'ON_HOLD' | 'IN_PROGRESS' | 'ESCALATED';
const statuses: statusType[] = [
  'REOPENED',
  'CLOSED',
  'ESCALATED',
  'ON_HOLD',
  'IN_PROGRESS',
  'OPEN',
];

export default function DistributionByStatus(props: WidgetProps) {
  const [selectedSection, setSelectedSection] = useLocalStorageState(
    'dashboard-case-and-alert-status-active-tab',
    'CASE',
  );
  const [granularity, setGranularity] = useState<GranularityValuesType>(
    granularityValues.MONTH as GranularityValuesType,
  );
  const [timeWindowType, setTimeWindowType] = useState<timeframe>('YEAR');

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>(DEFAULT_DATE_RANGE);
  const api = useApi();
  let startTimestamp = dayjs().subtract(1, 'day').valueOf();
  let endTimestamp = Date.now();

  const [start, end] = dateRange ?? [];
  if (start != null && end != null) {
    startTimestamp = start.startOf('day').valueOf();
    endTimestamp = end.endOf('day').valueOf();
  }

  const params = {
    entity: selectedSection as 'CASE' | 'ALERT',
    startTimestamp,
    endTimestamp,
    granularity,
  };

  const queryResult = useQuery(DASHBOARD_TRANSACTIONS_STATS(params), async () => {
    return await api.getDashboardStatsAlertAndCaseStatusDistributionStats(params);
  });

  const preparedDataRes = map(queryResult.data, (value): ColumnData<string, number, statusType> => {
    const result: ColumnData<string, number, statusType> = [];
    for (const datum of value?.data ?? []) {
      for (const status of statuses) {
        result.push({
          xValue: datum._id,
          yValue: datum[`count_${status}`] ?? 0,
          series: status,
        });
      }
    }
    return result;
  });

  return (
    <Widget
      {...props}
      extraControls={[
        <GranularDatePicker
          timeWindowType={timeWindowType}
          setTimeWindowType={setTimeWindowType}
          setGranularity={setGranularity}
          dateRange={dateRange}
          setDateRange={setDateRange}
        />,
      ]}
    >
      <div className={s.salesCard}>
        <AsyncResourceRenderer resource={preparedDataRes}>
          {(data) => {
            if (data.length === 0) {
              return <Empty description="No data available for selected period" />;
            }
            return (
              <div className={s.root}>
                <ScopeSelector
                  selectedSection={selectedSection}
                  setSelectedSection={setSelectedSection}
                />
                <Column<statusType>
                  data={data}
                  colors={{
                    OPEN: COLORS_V2_ANALYTICS_CHARTS_01,
                    IN_PROGRESS: COLORS_V2_ANALYTICS_CHARTS_04,
                    ON_HOLD: COLORS_V2_ANALYTICS_CHARTS_03,
                    ESCALATED: COLORS_V2_ANALYTICS_CHARTS_06,
                    CLOSED: COLORS_V2_ANALYTICS_CHARTS_08,
                    REOPENED: COLORS_V2_ANALYTICS_CHARTS_02,
                  }}
                  formatX={(xValue) => {
                    return formatDate(xValue);
                  }}
                  formatSeries={(seriesValue) => {
                    return seriesValue === 'REOPENED'
                      ? 'Re-opened'
                      : humanizeSnakeCase(seriesValue);
                  }}
                />
              </div>
            );
          }}
        </AsyncResourceRenderer>
      </div>
    </Widget>
  );
}
