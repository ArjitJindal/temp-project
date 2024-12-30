/* eslint-disable @typescript-eslint/no-var-requires */
import { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { Empty } from 'antd';
import { useLocalStorageState } from 'ahooks';
import { humanizeSnakeCase } from '@flagright/lib/utils/humanize';
import ScopeSelector from '../CaseClosingReasonCard/ScopeSelector';
import { formatDate } from '../../../utils/date-utils';
import GranularDatePicker, {
  DEFAULT_DATE_RANGE,
  GranularityValuesType,
  granularityValues,
  timeframe,
} from '../../widgets/GranularDatePicker/GranularDatePicker';
import s from './index.module.less';
import { Dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { map, isSuccess } from '@/utils/asyncResource';
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
  COLORS_V2_ANALYTICS_CHARTS_05,
  COLORS_V2_ANALYTICS_CHARTS_06,
  COLORS_V2_ANALYTICS_CHARTS_07,
  COLORS_V2_ANALYTICS_CHARTS_08,
} from '@/components/ui/colors';

type statusType =
  | 'OPEN'
  | 'CLOSED'
  | 'REOPENED'
  | 'ON_HOLD'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'IN_REVIEW'
  | 'ESCALATED_L2';

const statuses: statusType[] = [
  'REOPENED',
  'CLOSED',
  'ESCALATED',
  'ON_HOLD',
  'IN_PROGRESS',
  'OPEN',
  'IN_REVIEW',
  'ESCALATED_L2',
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

  const [start, end] = dateRange ?? [];
  const startTimestamp = start?.startOf('day').valueOf();
  const endTimestamp = end?.endOf('day').valueOf();

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
          key="granular-date-picker"
        />,
      ]}
    >
      <div className={s.salesCard}>
        {isSuccess(preparedDataRes) && preparedDataRes.value.length === 0 ? (
          <Empty description="No data available for selected period" />
        ) : (
          <div className={s.root}>
            <ScopeSelector
              selectedSection={selectedSection}
              setSelectedSection={setSelectedSection}
            />
            <Column<statusType>
              data={preparedDataRes}
              colors={{
                OPEN: COLORS_V2_ANALYTICS_CHARTS_01,
                IN_PROGRESS: COLORS_V2_ANALYTICS_CHARTS_04,
                ON_HOLD: COLORS_V2_ANALYTICS_CHARTS_03,
                ESCALATED: COLORS_V2_ANALYTICS_CHARTS_06,
                CLOSED: COLORS_V2_ANALYTICS_CHARTS_08,
                REOPENED: COLORS_V2_ANALYTICS_CHARTS_02,
                ESCALATED_L2: COLORS_V2_ANALYTICS_CHARTS_07,
                IN_REVIEW: COLORS_V2_ANALYTICS_CHARTS_05,
              }}
              formatX={formatDate}
              formatSeries={(seriesValue) => {
                return seriesValue === 'REOPENED' ? 'Re-opened' : humanizeSnakeCase(seriesValue);
              }}
            />
          </div>
        )}
      </div>
    </Widget>
  );
}
