/* eslint-disable @typescript-eslint/no-var-requires */
import { Empty } from 'antd';
import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import s from './index.module.less';
import { getRuleActionColorForDashboard } from '@/utils/rules';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs, YEAR_MONTH_DATE_FORMAT } from '@/utils/dayjs';
import { useApi } from '@/api';
import {
  getRuleActionLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TRANSACTIONS_STATS } from '@/utils/queries/keys';
import Column, { ColumnData } from '@/pages/dashboard/analysis/components/charts/Column';
import { RuleAction } from '@/apis';

const DEFAULT_DATE_RANGE: [Dayjs, Dayjs] = [dayjs().subtract(1, 'year'), dayjs()];

export type timeframe = 'YEAR' | 'MONTH' | 'WEEK' | 'DAY' | null;
type GranularityValuesType = 'HOUR' | 'MONTH' | 'DAY';
const granularityValues = { HOUR: 'HOUR', MONTH: 'MONTH', DAY: 'DAY' };

export default function TransactionsChartWidget(props: WidgetProps) {
  const settings = useSettings();

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>(DEFAULT_DATE_RANGE);
  const [granularity, setGranularity] = useState<GranularityValuesType>(
    granularityValues.MONTH as GranularityValuesType,
  );

  const calcGranularity = (type: string): GranularityValuesType => {
    if (type === 'YEAR') {
      return granularityValues.MONTH as GranularityValuesType;
    } else if (type === 'MONTH' || type === 'WEEK') {
      return granularityValues.DAY as GranularityValuesType;
    }
    return granularityValues.HOUR as GranularityValuesType;
  };
  const formatDate = (type: string): string => {
    if (type.match(/^\d{4}-\d{2}-\d{2}$/)) {
      type = dayjs(type, YEAR_MONTH_DATE_FORMAT).format('MM/DD');
    } else if (type.match(/^\d{4}-\d{2}$/)) {
      type = dayjs(type, 'YYYY-MM').format('YYYY/MM');
    } else if (type.match(/^\d{4}-\d{2}-\d{2}T\d{2}$/)) {
      type = dayjs(type, 'YYYY-MM-DDTHH').format('MM/DD HH:mm');
    }
    return type;
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

  const [timeWindowType, setTimeWindowType] = useState<timeframe>('YEAR');
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
              setDateRange(e ?? DEFAULT_DATE_RANGE);
              setTimeWindowType(null);
            }}
          />
        </div>,
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
                  yValue: item.stoppedTransactions ?? 0,
                  series: 'BLOCK',
                },
                {
                  xValue: item._id,
                  yValue: item.suspendedTransactions ?? 0,
                  series: 'SUSPEND',
                },
                {
                  xValue: item._id,
                  yValue: item.flaggedTransactions ?? 0,
                  series: 'FLAG',
                },
                {
                  xValue: item._id,
                  yValue:
                    (item.totalTransactions ?? 0) -
                    (item.stoppedTransactions ?? 0) -
                    (item.suspendedTransactions ?? 0) -
                    (item.flaggedTransactions ?? 0),
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
