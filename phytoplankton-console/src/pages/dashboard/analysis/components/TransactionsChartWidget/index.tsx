/* eslint-disable @typescript-eslint/no-var-requires */
import { Empty } from 'antd';
import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import GranularDatePicker, {
  DEFAULT_DATE_RANGE,
  granularityValues,
  GranularityValuesType,
} from '../widgets/GranularDatePicker/GranularDatePicker';
import { formatDate } from '../../utils/date-utils';
import { getRuleActionColorForDashboard } from '@/utils/rules';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import {
  getRuleActionLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TRANSACTIONS_STATS } from '@/utils/queries/keys';
import Column, { ColumnData } from '@/pages/dashboard/analysis/components/charts/Column';
import { RuleAction } from '@/apis';

export default function TransactionsChartWidget(props: WidgetProps) {
  const settings = useSettings();

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>(DEFAULT_DATE_RANGE);
  const [granularity, setGranularity] = useState<GranularityValuesType>(
    granularityValues.MONTH as GranularityValuesType,
  );

  const api = useApi();

  let startTimestamp = dayjs().subtract(1, 'year').valueOf();
  let endTimestamp = Date.now();

  const [start, end] = dateRange ?? DEFAULT_DATE_RANGE;
  if (start != null && end != null) {
    startTimestamp = start.startOf('day').valueOf();
    endTimestamp = end.endOf('day').valueOf();
  }

  const params = {
    startTimestamp,
    endTimestamp,
    granularity: granularity,
  };

  const queryResult = useQuery(DASHBOARD_TRANSACTIONS_STATS(params), async () => {
    return await api.getDashboardStatsTransactions(params);
  });

  return (
    <Widget
      extraControls={[
        <GranularDatePicker
          setGranularity={setGranularity}
          dateRange={dateRange}
          setDateRange={setDateRange}
        />,
      ]}
      resizing="AUTO"
      {...props}
    >
      <AsyncResourceRenderer resource={queryResult.data}>
        {({ data }) => {
          const preparedData: ColumnData<string, number, RuleAction> = data.flatMap(
            (item): ColumnData<string, number, RuleAction> => {
              return [
                {
                  xValue: item._id,
                  yValue: item.status_BLOCK ?? 0,
                  series: 'BLOCK',
                },
                {
                  xValue: item._id,
                  yValue: item.status_SUSPEND ?? 0,
                  series: 'SUSPEND',
                },
                {
                  xValue: item._id,
                  yValue: item.status_FLAG ?? 0,
                  series: 'FLAG',
                },
                {
                  xValue: item._id,
                  yValue: item.status_ALLOW ?? 0,
                  series: 'ALLOW',
                },
              ];
            },
          );
          return (
            <>
              {data.length === 0 ? (
                <Empty description="No data available for selected period" />
              ) : (
                <Column<RuleAction>
                  data={preparedData}
                  formatSeries={(action) => {
                    return getRuleActionLabel(action, settings) ?? action;
                  }}
                  formatX={(xValue) => {
                    return formatDate(xValue);
                  }}
                  colors={{
                    SUSPEND: getRuleActionColorForDashboard('SUSPEND'),
                    FLAG: getRuleActionColorForDashboard('FLAG'),
                    BLOCK: getRuleActionColorForDashboard('BLOCK'),
                    ALLOW: getRuleActionColorForDashboard('ALLOW'),
                  }}
                />
              )}
            </>
          );
        }}
      </AsyncResourceRenderer>
    </Widget>
  );
}
