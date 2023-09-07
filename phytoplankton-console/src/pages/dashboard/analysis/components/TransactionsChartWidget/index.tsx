/* eslint-disable @typescript-eslint/no-var-requires */
import { Empty } from 'antd';
import { Column } from '@ant-design/charts';
import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { each, groupBy } from 'lodash';
import { Annotation } from '@antv/g2plot';
import s from './index.module.less';
import { getRuleActionColorForDashboard } from '@/utils/rules';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs, YEAR_MONTH_DATE_FORMAT } from '@/utils/dayjs';
import { useApi } from '@/api';
import { useRiskActionLabel } from '@/components/AppWrapper/Providers/SettingsProvider';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { escapeHtml } from '@/utils/browser';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TRANSACTIONS_STATS } from '@/utils/queries/keys';

export type timeframe = 'YEAR' | 'MONTH' | 'WEEK' | 'DAY' | null;

export default function TransactionsChartWidget(props: WidgetProps) {
  type GranularityValuesType = 'HOUR' | 'MONTH' | 'DAY';
  const granularityValues = { HOUR: 'HOUR', MONTH: 'MONTH', DAY: 'DAY' };

  const suspendAlias = useRiskActionLabel('SUSPEND');
  const blockAlias = useRiskActionLabel('BLOCK');
  const flagAlias = useRiskActionLabel('FLAG');
  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'year'),
    dayjs(),
  ]);
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

  const [start, end] = dateRange ?? [];
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
        <AsyncResourceRenderer resource={queryResult.data}>
          {({ data }) => {
            const value: { _id: string; value: number; type: string }[] = [];
            data.map((item) => {
              value.push({
                _id: item._id,
                value: item.stoppedTransactions ?? 0,
                type: `${blockAlias}`,
              });
              value.push({
                _id: item._id,
                value: item.suspendedTransactions ?? 0,
                type: `${suspendAlias}`,
              });
              value.push({
                _id: item._id,
                value: item.flaggedTransactions ?? 0,
                type: `${flagAlias}`,
              });
              value.push({
                _id: item._id,
                value:
                  (item.totalTransactions ?? 0) -
                  (item.stoppedTransactions ?? 0) -
                  (item.suspendedTransactions ?? 0) -
                  (item.flaggedTransactions ?? 0),
                type: 'Allow',
              });
            });
            const annotations: Annotation[] | undefined = [];
            each(groupBy(value, '_id'), (values, k) => {
              const value = values.reduce((a, b) => a + b.value, 0);
              annotations.push({
                type: 'text',
                position: [k, value],
                content: escapeHtml(`${value}`),
                style: {
                  textAlign: 'center',
                  fontSize: 14,
                  fill: 'rgba(0,0,0,0.85)',
                },
                offsetY: -10,
              });
            });

            const preparedData = value.map((item) => {
              const _id = formatDate(item._id);
              const value = item.value;
              const type = item.type;
              return {
                _id,
                value,
                // required because of XSS issue inside of chart library: https://www.notion.so/flagright/Pen-Test-Fix-Cross-site-scripting-stored-62fcbe075a42476aac5963fc18e845f5?pvs=4
                type: escapeHtml(type),
              };
            });
            return (
              <div className={s.salesBar}>
                {data.length === 0 ? (
                  <Empty className={s.empty} description="No data available for selected period" />
                ) : (
                  <Column
                    height={256}
                    isStack={true}
                    data={preparedData}
                    xField={'_id'}
                    yField={'value'}
                    color={({ type }) => {
                      if (type === `${escapeHtml(suspendAlias ?? '')}`)
                        return getRuleActionColorForDashboard('SUSPEND');
                      if (type === `${escapeHtml(flagAlias ?? '')}`)
                        return getRuleActionColorForDashboard('FLAG');
                      if (type === `${escapeHtml(blockAlias ?? '')}`)
                        return getRuleActionColorForDashboard('BLOCK');
                      return getRuleActionColorForDashboard('ALLOW');
                    }}
                    xAxis={{
                      label: {
                        autoRotate: false,
                        autoHide: true,
                        rotate: -Math.PI / 6,
                        offsetX: -10,
                        offsetY: 10,
                        style: {
                          textAlign: 'right',
                          textBaseline: 'bottom',
                        },
                      },
                      title: null,
                      grid: {
                        line: {
                          style: {
                            stroke: 'transparent',
                          },
                        },
                      },
                    }}
                    yAxis={{
                      title: null,
                      label: {
                        formatter: (value) => {
                          return value.toLocaleString();
                        },
                      },
                      grid: {
                        line: {
                          style: {
                            stroke: 'transparent',
                          },
                        },
                      },
                    }}
                    meta={{
                      y: {
                        alias: 'Transaction Count',
                      },
                    }}
                    seriesField={'type'}
                    annotations={annotations}
                    legend={{
                      layout: 'horizontal',
                      position: 'bottom',
                      reversed: true,
                      padding: [40, 0, 0, 0],
                    }}
                  />
                )}
              </div>
            );
          }}
        </AsyncResourceRenderer>
      </div>
    </Widget>
  );
}
