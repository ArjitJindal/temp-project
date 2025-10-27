/* eslint-disable @typescript-eslint/no-var-requires */
import React, { MutableRefObject, useRef, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { Empty } from 'antd';
import { formatDate } from '../../utils/date-utils';
import GranularDatePicker, {
  DEFAULT_DATE_RANGE,
  GranularityValuesType,
  granularityValues,
  timeframe,
} from '../widgets/GranularDatePicker/GranularDatePicker';
import { exportDataForBarGraphs } from '../../utils/export-data-build-util';
import s from './index.module.less';
import { dayjs, Dayjs, SHORT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { useApi } from '@/api';
import { map, isSuccess, getOr } from '@/utils/asyncResource';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { RISK_LEVELS, RiskLevel } from '@/utils/risk-levels';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TRANSACTIONS_STATS } from '@/utils/queries/keys';
import BarChart, { BarChartData } from '@/components/charts/BarChart';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_03,
  COLORS_V2_ANALYTICS_CHARTS_04,
  COLORS_V2_ANALYTICS_CHARTS_05,
} from '@/components/ui/colors';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

export default function TransactionTRSChartCard(props: Partial<WidgetProps>) {
  const settings = useSettings();

  const [granularity, setGranularity] = useState<GranularityValuesType>(
    granularityValues.MONTH as GranularityValuesType,
  );
  const [timeWindowType, setTimeWindowType] = useState<timeframe>('YEAR');
  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>(DEFAULT_DATE_RANGE);
  const api = useApi();
  const [start, end] = dateRange ?? [];
  const startTimestamp = start ? dayjs(start).utc().startOf('day').valueOf() : undefined;
  const endTimestamp = end ? dayjs(end).utc().endOf('day').valueOf() : undefined;

  const params = {
    startTimestamp,
    endTimestamp,
    granularity,
  };

  const queryResult = useQuery(DASHBOARD_TRANSACTIONS_STATS(params), async () => {
    return await api.getDashboardStatsTransactions(params);
  });

  const preparedDataRes = map(queryResult.data, (value): BarChartData<string, RiskLevel> => {
    const result: BarChartData<string, RiskLevel> = [];
    for (const datum of value?.data ?? []) {
      for (const riskLevel of RISK_LEVELS) {
        result.push({
          category: datum.time,
          value: datum[`arsRiskLevel_${riskLevel}`] ?? 0,
          series: riskLevel,
        });
      }
    }
    return result;
  });

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
          'Risk level',
          ['category'],
          ['asc'],
        );

        return Promise.resolve({
          fileName: `-transactions-by-trs-${dayjs().format('YYYY_MM_DD')}`,
          data: csvExportedData,
          pdfRef,
          tableTitle: `Transactions by TRS (${dayjs(startTimestamp).format(
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
      {...props}
    >
      <div className={s.salesCard} ref={pdfRef}>
        {isSuccess(preparedDataRes) && preparedDataRes.value.length === 0 ? (
          <Empty description="No data available for selected period" />
        ) : (
          <BarChart<string, RiskLevel>
            data={preparedDataRes}
            colors={{
              VERY_LOW: COLORS_V2_ANALYTICS_CHARTS_01,
              LOW: COLORS_V2_ANALYTICS_CHARTS_04,
              MEDIUM: COLORS_V2_ANALYTICS_CHARTS_03,
              HIGH: COLORS_V2_ANALYTICS_CHARTS_05,
              VERY_HIGH: COLORS_V2_ANALYTICS_CHARTS_02,
            }}
            formatSeries={(series) => {
              return getRiskLevelLabel(series, settings).riskLevelLabel;
            }}
            formatCategory={formatDate}
          />
        )}
      </div>
    </Widget>
  );
}
