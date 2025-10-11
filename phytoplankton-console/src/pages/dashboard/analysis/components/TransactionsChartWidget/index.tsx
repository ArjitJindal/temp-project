/* eslint-disable @typescript-eslint/no-var-requires */
import { Empty } from 'antd';
import React, { MutableRefObject, useMemo, useRef, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import GranularDatePicker, {
  DEFAULT_DATE_RANGE,
  granularityValues,
  GranularityValuesType,
  timeframe,
} from '../widgets/GranularDatePicker/GranularDatePicker';
import { formatDate } from '../../utils/date-utils';
import { exportDataForBarGraphs } from '../../utils/export-data-build-util';
import { getRuleActionColorForDashboard } from '@/utils/rules';
import { dayjs, Dayjs, SHORT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { useDashboardTransactionsStats } from '@/hooks/api';
import {
  getRuleActionLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { RuleAction } from '@/apis';
import { getOr, isSuccess, map } from '@/utils/asyncResource';
import BarChart, { BarChartData } from '@/components/charts/BarChart';

export type TransactionChartSeries = RuleAction | 'ALLOW (MANUAL)' | 'BLOCK (MANUAL)';
export default function TransactionsChartWidget(props: WidgetProps) {
  const settings = useSettings();
  const [timeWindowType, setTimeWindowType] = useState<timeframe>('YEAR');

  const isPaymentApprovalEnabled = useMemo(() => {
    return settings.isPaymentApprovalEnabled;
  }, [settings]);

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>(DEFAULT_DATE_RANGE);
  const [granularity, setGranularity] = useState<GranularityValuesType>(
    granularityValues.MONTH as GranularityValuesType,
  );

  const [start, end] = dateRange ?? [];
  const startTimestamp = start?.startOf('day').valueOf();
  const endTimestamp = end?.endOf('day').valueOf();

  const params = {
    startTimestamp,
    endTimestamp,
    granularity: granularity,
  };

  const queryResult = useDashboardTransactionsStats(params);

  const dataResource = map(
    queryResult.data,
    ({ data }): BarChartData<string, TransactionChartSeries> =>
      data.flatMap((item): BarChartData<string, TransactionChartSeries> => {
        return [
          {
            category: item.time,
            value: isPaymentApprovalEnabled
              ? (item.status_BLOCK ?? 0) - (item.status_BLOCK_MANUAL ?? 0)
              : item.status_BLOCK ?? 0,
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
            value: isPaymentApprovalEnabled
              ? (item.status_ALLOW ?? 0) - (item.status_ALLOW_MANUAL ?? 0)
              : item.status_ALLOW ?? 0,
            series: 'ALLOW',
          },
          ...(isPaymentApprovalEnabled
            ? [
                {
                  category: item.time,
                  value: item.status_ALLOW_MANUAL ?? 0,
                  series: 'ALLOW (MANUAL)' as TransactionChartSeries,
                },
                {
                  category: item.time,
                  value: item.status_BLOCK_MANUAL ?? 0,
                  series: 'BLOCK (MANUAL)' as TransactionChartSeries,
                },
              ]
            : []),
        ];
      }),
  );

  const pdfRef = useRef() as MutableRefObject<HTMLInputElement>;

  return (
    <Widget
      onDownload={(): Promise<{
        fileName: string;
        data: string;
        pdfRef: MutableRefObject<HTMLInputElement>;
      }> => {
        const csvExportedData = exportDataForBarGraphs(
          getOr(dataResource, []),
          'Date',
          'Value',
          'Action',
          ['category'],
          ['asc'],
        );

        return Promise.resolve({
          fileName: `transactions-by-rule-actions-${dayjs().format('YYYY_MM_DD')}`,
          data: csvExportedData,
          pdfRef,
          tableTitle: `Transactions by rule action (${dayjs(startTimestamp).format(
            SHORT_DATE_TIME_FORMAT,
          )} - ${dayjs(endTimestamp).format(SHORT_DATE_TIME_FORMAT)})`,
        });
      }}
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
      <div ref={pdfRef}>
        {isSuccess(dataResource) && dataResource.value.length === 0 ? (
          <Empty description="No data available for selected period" />
        ) : (
          <BarChart<string, TransactionChartSeries>
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
      </div>
    </Widget>
  );
}
