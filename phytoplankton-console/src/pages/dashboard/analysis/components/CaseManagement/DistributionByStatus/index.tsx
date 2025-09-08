/* eslint-disable @typescript-eslint/no-var-requires */
import { MutableRefObject, useRef, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { Empty } from 'antd';
import { humanizeSnakeCase } from '@flagright/lib/utils/humanize';
import ScopeSelector from '../CaseClosingReasonCard/ScopeSelector';
import { formatDate } from '../../../utils/date-utils';
import GranularDatePicker, {
  DEFAULT_DATE_RANGE,
  GranularityValuesType,
  granularityValues,
  timeframe,
} from '../../widgets/GranularDatePicker/GranularDatePicker';
import { exportDataForBarGraphs } from '../../../utils/export-data-build-util';
import s from './index.module.less';
import { dayjs, Dayjs, SHORT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { useApi } from '@/api';
import { map, isSuccess, getOr } from '@/utils/asyncResource';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TRANSACTIONS_STATS } from '@/utils/queries/keys';
import BarChart, { BarChartData } from '@/components/charts/BarChart';
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
import { useRuleOptions } from '@/utils/rules';
import Select from '@/components/library/Select';
import { useSafeLocalStorageState } from '@/utils/hooks';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';

type StatusType =
  | 'OPEN'
  | 'CLOSED'
  | 'REOPENED'
  | 'ON_HOLD'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'IN_REVIEW'
  | 'ESCALATED_L2';

const statuses: StatusType[] = [
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
  const [selectedSection, setSelectedSection] = useSafeLocalStorageState(
    'dashboard-case-and-alert-status-active-tab',
    'CASE',
  );
  const [granularity, setGranularity] = useState<GranularityValuesType>(
    granularityValues.MONTH as GranularityValuesType,
  );
  const [timeWindowType, setTimeWindowType] = useState<timeframe>('YEAR');
  const [selectedRules, setSelectedRules] = useState<string[]>([]);

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>(DEFAULT_DATE_RANGE);
  const api = useApi();
  const ruleOptions = useRuleOptions();

  const [start, end] = dateRange ?? [];
  const startTimestamp = start?.startOf('day').valueOf();
  const endTimestamp = end?.endOf('day').valueOf();

  const params = {
    entity: selectedSection as 'CASE' | 'ALERT',
    startTimestamp,
    endTimestamp,
    granularity,
    ruleInstanceIds: selectedRules.length > 0 ? selectedRules : undefined,
  };

  const queryResult = useQuery(DASHBOARD_TRANSACTIONS_STATS(params), async () => {
    return await api.getDashboardStatsAlertAndCaseStatusDistributionStats(params);
  });

  const preparedDataRes = map(queryResult.data, (value): BarChartData<string, StatusType> => {
    const result: BarChartData<string, StatusType> = [];
    for (const datum of value?.data ?? []) {
      for (const status of statuses) {
        result.push({
          category: datum._id,
          value: datum[`count_${status}`] ?? 0,
          series: status,
        });
      }
    }
    return result;
  });

  const handleRulesChange = (newSelectedRules: string[] | undefined) => {
    setSelectedRules(newSelectedRules || []);
  };

  const pdfRef = useRef() as MutableRefObject<HTMLInputElement>;

  return (
    <Widget
      onDownload={(): Promise<{
        fileName: string;
        data: string;
        pdfRef: MutableRefObject<HTMLInputElement>;
      }> => {
        const csvExportedData = exportDataForBarGraphs(
          getOr(preparedDataRes, []),
          'Date',
          'Value',
          'Status',
          ['category'],
          ['asc'],
        );

        return Promise.resolve({
          fileName: `distribution-by-status-${dayjs().format('YYYY_MM_DD')}`,
          data: csvExportedData,
          pdfRef,
          tableTitle: `Distribution by status (${dayjs(startTimestamp).format(
            SHORT_DATE_TIME_FORMAT,
          )} - ${dayjs(endTimestamp).format(SHORT_DATE_TIME_FORMAT)})`,
        });
      }}
      extraControls={[
        <div key="rule-filter" style={{ display: 'flex', alignItems: 'center', marginRight: 16 }}>
          <Feature name="NEW_FEATURES">
            <Select
              mode="MULTIPLE"
              allowClear
              placeholder="Filter by Rules"
              options={ruleOptions.filter(Boolean) as { value: string; label: string }[]}
              value={selectedRules}
              onChange={handleRulesChange}
            />
          </Feature>
        </div>,
        <GranularDatePicker
          timeWindowType={timeWindowType}
          setTimeWindowType={setTimeWindowType}
          setGranularity={setGranularity}
          dateRange={dateRange}
          setDateRange={setDateRange}
          key="granular-date-picker"
        />,
      ]}
      {...props}
    >
      <div className={s.salesCard} ref={pdfRef}>
        {isSuccess(preparedDataRes) && preparedDataRes.value.length === 0 ? (
          <Empty description="No data available for selected period" />
        ) : (
          <div className={s.root}>
            <ScopeSelector
              selectedSection={selectedSection}
              setSelectedSection={setSelectedSection}
            />
            <BarChart<string, StatusType>
              grouping={'STACKED'}
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
              formatCategory={formatDate}
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
