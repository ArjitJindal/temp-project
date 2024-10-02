import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { useLocalStorageState } from 'ahooks';
import s from './index.module.less';
import AccountsStatisticsTable from './AccountsStatisticsTable';
import LatestOverviewTable from './LatestTeamOverview';
import CompositeLatestTeamOverview from './CompositeLatestTeamOverview';
import CompositeAccountsStatisticsTable from './ComopsiteAccountStatisticsTable';
import SegmentedControl from '@/components/library/SegmentedControl';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { AllParams, CommonParams as TableCommonParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TEAM_STATS } from '@/utils/queries/keys';
import {
  AlertStatus,
  CaseStatus,
  DashboardLatestTeamStatsItem,
  DashboardTeamStatsItem,
} from '@/apis';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import Select from '@/components/library/Select';
import Button from '@/components/library/Button';

interface Params extends TableCommonParams {
  scope: 'CASES' | 'ALERTS';
  dateRange?: RangeValue<Dayjs>;
  caseStatus?: (CaseStatus | AlertStatus)[];
}

export default function TeamPerformanceCard(props: WidgetProps) {
  const startTime = dayjs().subtract(1, 'day').startOf('day');
  const endTime = dayjs().endOf('day');
  const [type, setType] = useLocalStorageState<'current' | 'daterange'>(
    'team-performance-card-type',
    'current',
  );

  const [params, setParams] = useState<AllParams<Params>>({
    ...DEFAULT_PARAMS_STATE,
    scope: 'CASES',
    dateRange: [startTime, endTime],
  });

  const defaultDateRange: RangeValue<Dayjs> = [startTime, endTime];
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const getDateRangeToShow = (dateRange: RangeValue<Dayjs> | undefined) => {
    return isDatePickerOpen ? dateRange ?? defaultDateRange : dateRange;
  };
  const api = useApi();

  const dateRangeQueryResult = useQuery(
    DASHBOARD_TEAM_STATS(params),
    async (): Promise<DashboardTeamStatsItem[]> => {
      const [start, end] = params.dateRange ?? [];
      let startTimestamp, endTimestamp;
      if (start != null && end != null) {
        startTimestamp = start.startOf('day').valueOf();
        endTimestamp = end.endOf('day').valueOf();
      }
      const data = await api.getDashboardTeamStats({
        scope: params.scope,
        startTimestamp,
        endTimestamp,
        caseStatus: params.caseStatus,
      });

      const updatedData = data.map((item) => ({
        ...item,
        investigationTime:
          item.investigationTime && item.caseIds?.length
            ? item.investigationTime / item.caseIds.length
            : 0,
      }));

      return updatedData;
    },
  );

  const latestQueryResut = useQuery(
    DASHBOARD_TEAM_STATS({ ...params, type }),
    async (): Promise<DashboardLatestTeamStatsItem[]> => {
      return await api.getDashboardLatestTeamStats({
        scope: params.scope,
      });
    },
  );

  const [showAggregatedView, setShowAggregatedView] = useState(false);

  return (
    <Widget
      extraControls={[
        <Select<'current' | 'daterange'>
          key="select"
          value={type}
          onChange={(value) => {
            if (value) {
              setType(value);
            }
          }}
          options={[
            { value: 'current', label: 'Current' },
            { value: 'daterange', label: 'Date range' },
          ]}
          style={{ width: 120 }}
        />,
        <Button
          key="toggleView"
          onClick={() => setShowAggregatedView(!showAggregatedView)}
          type={showAggregatedView ? 'SECONDARY' : 'PRIMARY'}
        >
          {showAggregatedView ? 'Show Individual' : 'Show Aggregated'}
        </Button>,
      ]}
      {...props}
    >
      <div className={s.header}>
        <SegmentedControl<Params['scope']>
          active={params.scope}
          items={[
            { value: 'CASES', label: 'Cases' },
            { value: 'ALERTS', label: 'Alerts' },
          ]}
          onChange={(newActive) => {
            setParams((prevState) => ({ ...prevState, scope: newActive }));
          }}
        />
        {type === 'daterange' && (
          <DatePicker.RangePicker
            value={getDateRangeToShow(params.dateRange)}
            onChange={(value) => {
              setParams((prevState) => ({
                ...prevState,
                dateRange: value,
              }));
            }}
            onOpenChange={(state) => {
              setIsDatePickerOpen(state);
            }}
          />
        )}
      </div>
      {type === 'daterange' ? (
        showAggregatedView ? (
          <CompositeAccountsStatisticsTable
            queryResult={dateRangeQueryResult}
            scope={params.scope}
          />
        ) : (
          <AccountsStatisticsTable queryResult={dateRangeQueryResult} scope={params.scope} />
        )
      ) : showAggregatedView ? (
        <CompositeLatestTeamOverview queryResult={latestQueryResut} />
      ) : (
        <LatestOverviewTable queryResult={latestQueryResut} />
      )}
    </Widget>
  );
}
