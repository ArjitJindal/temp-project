/* eslint-disable @typescript-eslint/no-var-requires */
import { Empty } from 'antd';
import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import GranularDatePicker, {
  DEFAULT_DATE_RANGE,
  granularityValues,
  GranularityValuesType,
  timeframe,
} from '../widgets/GranularDatePicker/GranularDatePicker';
import { formatDate } from '../../utils/date-utils';
import { getRuleActionColorForDashboard } from '@/utils/rules';
import { Dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import {
  getRuleActionLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TRANSACTIONS_STATS } from '@/utils/queries/keys';
import { RuleAction } from '@/apis';
import { isSuccess, map } from '@/utils/asyncResource';
import BarChart, { BarChartData } from '@/components/charts/BarChart';

export default function TransactionsChartWidget(props: WidgetProps) {
  const settings = useSettings();
  const [timeWindowType, setTimeWindowType] = useState<timeframe>('YEAR');

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>(DEFAULT_DATE_RANGE);
  const [granularity, setGranularity] = useState<GranularityValuesType>(
    granularityValues.MONTH as GranularityValuesType,
  );

  const api = useApi();

  const [start, end] = dateRange ?? [];
  const startTimestamp = start?.startOf('day').valueOf();
  const endTimestamp = end?.endOf('day').valueOf();

  const params = {
    startTimestamp,
    endTimestamp,
    granularity: granularity,
  };

  const queryResult = useQuery(DASHBOARD_TRANSACTIONS_STATS(params), async () => {
    return await api.getDashboardStatsTransactions(params);
  });

  const dataResource = map(
    queryResult.data,
    ({ data }): BarChartData<string, RuleAction> =>
      data.flatMap((item): BarChartData<string, RuleAction> => {
        return [
          {
            category: item.time,
            value: item.status_BLOCK ?? 0,
            series: 'BLOCK',
          },
          {
            category: item.time,
            value: item.status_SUSPEND ?? 0,
            series: 'SUSPEND',
          },
          {
            category: item.time,
            value: item.status_FLAG ?? 0,
            series: 'FLAG',
          },
          {
            category: item.time,
            value: item.status_ALLOW ?? 0,
            series: 'ALLOW',
          },
        ];
      }),
  );

  return (
    <Widget
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
      resizing="AUTO"
      {...props}
    >
      <>
        {isSuccess(dataResource) && dataResource.value.length === 0 ? (
          <Empty description="No data available for selected period" />
        ) : (
          <BarChart<string, RuleAction>
            grouping={'STACKED'}
            data={dataResource}
            height={400}
            formatSeries={(action) => {
              return getRuleActionLabel(action, settings) ?? action;
            }}
            formatCategory={formatDate}
            colors={{
              SUSPEND: getRuleActionColorForDashboard('SUSPEND'),
              FLAG: getRuleActionColorForDashboard('FLAG'),
              BLOCK: getRuleActionColorForDashboard('BLOCK'),
              ALLOW: getRuleActionColorForDashboard('ALLOW'),
            }}
          />
        )}
      </>
    </Widget>
  );
}
