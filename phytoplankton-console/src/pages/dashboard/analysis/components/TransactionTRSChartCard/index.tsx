/* eslint-disable @typescript-eslint/no-var-requires */
import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { Empty } from 'antd';
import s from './index.module.less';
import { dayjs, Dayjs, YEAR_MONTH_DATE_FORMAT } from '@/utils/dayjs';
import { useApi } from '@/api';
import { map } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
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
import DatePicker from '@/components/ui/DatePicker';

export type timeframe = 'YEAR' | 'MONTH' | 'WEEK' | 'DAY' | null;

type GranularityValuesType = 'HOUR' | 'MONTH' | 'DAY';
const granularityValues = { HOUR: 'HOUR', MONTH: 'MONTH', DAY: 'DAY' };

const calcGranularity = (type: string): GranularityValuesType => {
  if (type === 'YEAR') {
    return granularityValues.MONTH as GranularityValuesType;
  } else if (type === 'MONTH' || type === 'WEEK') {
    return granularityValues.DAY as GranularityValuesType;
  }
  return granularityValues.HOUR as GranularityValuesType;
};

const dayCalc = (val: string) => {
  if (val === 'YEAR') {
    return dayjs().subtract(1, 'year');
  } else if (val === 'MONTH') {
    return dayjs().subtract(1, 'month');
  } else if (val === 'WEEK') {
    return dayjs().subtract(1, 'week');
  }
  return dayjs().subtract(1, 'day');
};

export default function TransactionTRSChartCard(props: WidgetProps) {
  const settings = useSettings();

  const [timeWindowType, setTimeWindowType] = useState<timeframe>('YEAR');

  const [granularity, setGranularity] = useState<GranularityValuesType>(
    granularityValues.MONTH as GranularityValuesType,
  );

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'year'),
    dayjs(),
  ]);
  const api = useApi();
  let startTimestamp = dayjs().subtract(1, 'day').valueOf();
  let endTimestamp = Date.now();

  const [start, end] = dateRange ?? [];
  if (start != null && end != null) {
    startTimestamp = start.startOf('day').valueOf();
    endTimestamp = end.endOf('day').valueOf();
  }

  const formatDate = (str: string): string => {
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
      str = dayjs(str, YEAR_MONTH_DATE_FORMAT).format('MM/DD');
    } else if (str.match(/^\d{4}-\d{2}$/)) {
      str = dayjs(str, 'YYYY-MM').format('YYYY/MM');
    } else if (str.match(/^\d{4}-\d{2}-\d{2}T\d{2}$/)) {
      str = dayjs(str, 'YYYY-MM-DDTHH').format('MM/DD HH:mm');
    }
    return str;
  };

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
          xValue: datum._id,
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
        <div className={s.salesExtraWrap}>
          <div className={s.salesExtra}>
            {[
              { type: 'DAY' as const, title: 'Day' },
              { type: 'WEEK' as const, title: 'Week' },
              { type: 'MONTH' as const, title: 'Month' },
              { type: 'YEAR' as const, title: 'Year' },
            ].map(({ type, title }) => (
              <a
                key={type}
                className={type === timeWindowType ? s.currentDate : ''}
                onClick={() => {
                  setTimeWindowType(type);
                  setDateRange([dayCalc(type), dayjs()]);
                  setGranularity(calcGranularity(type));
                }}
              >
                {title}
              </a>
            ))}
          </div>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(e) => {
              setDateRange(e);
              setTimeWindowType(null);
            }}
          />
        </div>,
      ]}
    >
      <div className={s.salesCard}>
        <AsyncResourceRenderer resource={preparedDataRes}>
          {(data) => {
            if (data.length === 0) {
              return <Empty description="No data available for selected period" />;
            }
            return (
              <Column<RiskLevel>
                data={data}
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
                formatX={(xValue) => {
                  return formatDate(xValue);
                }}
              />
            );
          }}
        </AsyncResourceRenderer>
      </div>
    </Widget>
  );
}
