/* eslint-disable @typescript-eslint/no-var-requires */
import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { Empty } from 'antd';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { map } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TRANSACTIONS_TOTAL_STATS } from '@/utils/queries/keys';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_04,
  COLORS_V2_ANALYTICS_CHARTS_05,
  COLORS_V2_ANALYTICS_CHARTS_07,
  COLORS_V2_ANALYTICS_CHARTS_10,
} from '@/components/ui/colors';
import Donut, { DonutData } from '@/pages/dashboard/analysis/components/charts/Donut';
import { TRANSACTION_TYPES } from '@/utils/transactionType';
import { TransactionType } from '@/apis';
import { humanizeConstant } from '@/utils/humanize';
import DatePicker from '@/components/ui/DatePicker';

const DEFAULT_DATE_RANGE: [Dayjs, Dayjs] = [dayjs().subtract(1, 'year'), dayjs()];

export type timeframe = 'YEAR' | 'MONTH' | 'WEEK' | 'DAY' | null;

export default function DistributionByTransactionTypeWidget(props: WidgetProps) {
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
    startTimestamp,
    endTimestamp,
  };

  const queryResult = useQuery(DASHBOARD_TRANSACTIONS_TOTAL_STATS(params), async () => {
    return await api.getDashboardStatsTransactionsTotal(params);
  });

  const preparedDataRes = map(queryResult.data, (value): DonutData<TransactionType> => {
    const result: DonutData<TransactionType> = [];
    for (const transactionType of TRANSACTION_TYPES) {
      result.push({
        value: value?.data[`transactionType_${transactionType}`] ?? 0,
        series: transactionType,
      });
    }
    return result;
  });

  return (
    <Widget
      extraControls={[
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(e) => setDateRange(e ?? DEFAULT_DATE_RANGE)}
        />,
      ]}
      {...props}
    >
      <AsyncResourceRenderer resource={preparedDataRes}>
        {(data) => {
          if (data.length === 0) {
            return <Empty description="No data available for selected period" />;
          }
          return (
            <Donut<TransactionType>
              data={data}
              colors={{
                DEPOSIT: COLORS_V2_ANALYTICS_CHARTS_04,
                TRANSFER: COLORS_V2_ANALYTICS_CHARTS_05,
                EXTERNAL_PAYMENT: COLORS_V2_ANALYTICS_CHARTS_10,
                WITHDRAWAL: COLORS_V2_ANALYTICS_CHARTS_01,
                REFUND: COLORS_V2_ANALYTICS_CHARTS_02,
                OTHER: COLORS_V2_ANALYTICS_CHARTS_07,
              }}
              formatSeries={(series) => {
                return humanizeConstant(series);
              }}
            />
          );
        }}
      </AsyncResourceRenderer>
    </Widget>
  );
}
