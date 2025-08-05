import { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import s from './index.module.less';
import AccountsStatisticsTable from './AccountsStatisticsTable';
import LatestOverviewTable from './LatestTeamOverview';
import CompositeLatestTeamOverview from './CompositeLatestTeamOverview';
import CompositeAccountsStatisticsTable from './ComopsiteAccountStatisticsTable';
import SegmentedControl from '@/components/library/SegmentedControl';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import {
  AllParams,
  CommonParams,
  CommonParams as TableCommonParams,
} from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TEAM_STATS } from '@/utils/queries/keys';
import {
  AlertStatus,
  CaseStatus,
  DashboardLatestTeamStatsItemResponse,
  DashboardTeamStatsItem,
  DashboardTeamStatsItemResponse,
} from '@/apis';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import Select from '@/components/library/Select';
import Button from '@/components/library/Button';
import { notEmpty } from '@/utils/array';
import { useSafeLocalStorageState } from '@/utils/hooks';

interface Params extends TableCommonParams {
  scope: 'CASES' | 'ALERTS';
  dateRange?: RangeValue<Dayjs>;
  caseStatus?: (CaseStatus | AlertStatus)[];
}

export default function TeamPerformanceCard(props: WidgetProps) {
  const startTime = dayjs().subtract(1, 'month');
  const endTime = dayjs();
  const [type, setType] = useSafeLocalStorageState<'current' | 'daterange'>(
    'team-performance-card-type',
    'current',
  );

  const [paginationParams, setPaginationParams] = useState<CommonParams>({
    page: 1,
    pageSize: 10,
    sort: [],
  });

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

  const dateRangeQueryResult = usePaginatedQuery(
    DASHBOARD_TEAM_STATS({
      page: paginationParams.page,
      pageSize: paginationParams.pageSize,
      scope: params.scope,
      caseStatus: params.caseStatus,
      dateRange: params.dateRange,
    }),
    async (p): Promise<DashboardTeamStatsItemResponse> => {
      const [start, end] = params.dateRange ?? [];
      let startTimestamp, endTimestamp;
      if (start != null && end != null) {
        startTimestamp = start.startOf('day').valueOf();
        endTimestamp = end.endOf('day').valueOf();
      }
      const response = await api.getDashboardTeamStats({
        scope: params.scope,
        startTimestamp,
        endTimestamp,
        caseStatus: params.caseStatus,
        page: p?.page ?? paginationParams.page,
        pageSize: p?.pageSize ?? paginationParams.pageSize,
      });

      const updatedItems = response.items?.map((item: DashboardTeamStatsItem) => ({
        ...item,
        investigationTime:
          item.investigationTime && item.caseIds?.length
            ? item.investigationTime / item.caseIds.length
            : 0,
      }));

      return {
        total: response.total,
        items: updatedItems,
      };
    },
  );

  const latestQueryResult = usePaginatedQuery(
    DASHBOARD_TEAM_STATS({
      page: paginationParams.page,
      pageSize: paginationParams.pageSize,
      scope: params.scope,
    }),
    async (p): Promise<DashboardLatestTeamStatsItemResponse> => {
      const response = await api.getDashboardLatestTeamStats({
        scope: params.scope,
        page: p?.page ?? paginationParams.page,
        pageSize: p?.pageSize ?? paginationParams.pageSize,
      });

      return {
        total: response.total,
        items: response.items,
      };
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
        />,
        type === 'daterange' && (
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
        ),
        <Button
          key="toggleView"
          onClick={() => setShowAggregatedView(!showAggregatedView)}
          type={showAggregatedView ? 'SECONDARY' : 'PRIMARY'}
        >
          {showAggregatedView ? 'Show Individual' : 'Show Aggregated'}
        </Button>,
      ].filter(notEmpty)}
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
      </div>
      {type === 'daterange' ? (
        showAggregatedView ? (
          <CompositeAccountsStatisticsTable
            queryResult={dateRangeQueryResult}
            scope={params.scope}
            paginationParams={paginationParams}
            setPaginationParams={setPaginationParams}
          />
        ) : (
          <AccountsStatisticsTable
            queryResult={dateRangeQueryResult}
            scope={params.scope}
            paginationParams={paginationParams}
            setPaginationParams={setPaginationParams}
          />
        )
      ) : showAggregatedView ? (
        <CompositeLatestTeamOverview
          paginationParams={paginationParams}
          queryResult={latestQueryResult}
          setPaginationParams={setPaginationParams}
        />
      ) : (
        <LatestOverviewTable
          paginationParams={paginationParams}
          queryResult={latestQueryResult}
          setPaginationParams={setPaginationParams}
        />
      )}
    </Widget>
  );
}
