/* eslint-disable @typescript-eslint/no-var-requires */
import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { Empty } from 'antd';
import { formatDate } from '../../utils/date-utils';
import GranularDatePicker, {
  DEFAULT_DATE_RANGE,
  GranularityValuesType,
  granularityValues,
  timeframe,
} from '../widgets/GranularDatePicker/GranularDatePicker';
import s from './index.module.less';
import { Dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { map, isSuccess } from '@/utils/asyncResource';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { RISK_LEVELS, RiskLevel } from '@/utils/risk-levels';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TRANSACTIONS_STATS } from '@/utils/queries/keys';
import Column, { ColumnData } from '@/pages/dashboard/analysis/components/charts/Column';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_03,
  COLORS_V2_ANALYTICS_CHARTS_04,
  COLORS_V2_ANALYTICS_CHARTS_05,
} from '@/components/ui/colors';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

export default function TransactionTRSChartCard(props: WidgetProps) {
  const settings = useSettings();

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
    startTimestamp,
    endTimestamp,
    granularity,
  };

  const queryResult = useQuery(DASHBOARD_TRANSACTIONS_STATS(params), async () => {
    return await api.getDashboardStatsTransactions(params);
  });

  const preparedDataRes = map(queryResult.data, (value): ColumnData<string, number, RiskLevel> => {
    const result: ColumnData<string, number, RiskLevel> = [];
    for (const datum of value?.data ?? []) {
      for (const riskLevel of RISK_LEVELS) {
        result.push({
          xValue: datum.time,
          yValue: datum[`arsRiskLevel_${riskLevel}`] ?? 0,
          series: riskLevel,
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
          <Column<RiskLevel>
            data={preparedDataRes}
            colors={{
              VERY_LOW: COLORS_V2_ANALYTICS_CHARTS_01,
              LOW: COLORS_V2_ANALYTICS_CHARTS_04,
              MEDIUM: COLORS_V2_ANALYTICS_CHARTS_03,
              HIGH: COLORS_V2_ANALYTICS_CHARTS_05,
              VERY_HIGH: COLORS_V2_ANALYTICS_CHARTS_02,
            }}
            formatSeries={(series) => {
              return getRiskLevelLabel(series, settings);
            }}
            formatX={formatDate}
          />
        )}
      </div>
    </Widget>
  );
}
