import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import {
  AllParams,
  CommonParams,
  CommonParams as TableCommonParams,
} from '@/components/library/Table/types';
import { Dayjs, dayjs } from '@/utils/dayjs';
import { WidgetProps } from '@/components/library/Widget/types';
import { useDashboardTeamSlaStats } from '@/hooks/api/dashboard';
import { DashboardStatsTeamSLAItem } from '@/apis';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import Widget from '@/components/library/Widget';
import DatePicker from '@/components/ui/DatePicker';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import AccountTag from '@/components/AccountTag';
import { getOr } from '@/utils/asyncResource';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { getCsvData } from '@/pages/dashboard/analysis/utils/export-data-build-util';
import { useUsers } from '@/utils/user-utils';

interface Params extends TableCommonParams {
  dateRange?: RangeValue<Dayjs>;
}

function TeamSLAPerformanceCard(props: WidgetProps) {
  const [users] = useUsers({ includeBlockedUsers: true, includeRootUsers: true });
  const startTime = dayjs().subtract(1, 'month');
  const endTime = dayjs();
  const [params, setParams] = useState<AllParams<Params>>({
    ...DEFAULT_PARAMS_STATE,
    dateRange: [startTime, endTime],
  });
  const [paginationParams, setPaginationParams] = useState<CommonParams>({
    page: 1,
    pageSize: 10,
    sort: [],
  });

  const [start, end] = params.dateRange ?? [];
  const startTimestamp = start?.startOf('day').valueOf();
  const endTimestamp = end?.endOf('day').valueOf();
  const queryResult = useDashboardTeamSlaStats({
    startTimestamp,
    endTimestamp,
    ...paginationParams,
  });

  const helper = new ColumnHelper<DashboardStatsTeamSLAItem>();
  const columns = helper.list([
    helper.simple({
      key: 'accountId',
      title: 'Team member',
      defaultWidth: 250,
      type: {
        render: (accountId) => <AccountTag accountId={accountId} />,
      },
    }),
    helper.simple({
      key: 'BREACHED',
      title: 'Breached',
      defaultWidth: 100,
    }),
    helper.simple({
      key: 'WARNING',
      title: 'Warning',
      defaultWidth: 100,
    }),
    helper.simple({
      key: 'OK',
      title: 'OK',
      defaultWidth: 100,
    }),
  ]);

  const dataToExport = (items: DashboardStatsTeamSLAItem[]) => {
    return items.map((item) => ({
      'Team Member': users[item.accountId]?.name || item.accountId,
      Breached: item.BREACHED,
      Warning: item.WARNING,
      OK: item.OK,
    }));
  };

  return (
    <Widget
      {...props}
      extraControls={[
        <DatePicker.RangePicker
          value={params.dateRange}
          onChange={(value) => {
            setParams((prevValue) => {
              return {
                ...prevValue,
                dateRange: value,
              };
            });
          }}
          key="date-range-picker"
        />,
      ]}
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        return new Promise((resolve) => {
          const fileData = {
            fileName: `team-sla-performance-${dayjs().format('YYYY-MM-DD')}.csv`,
            data: getCsvData(dataToExport(getOr(queryResult.data, { items: [], total: 0 }).items)),
          };
          resolve(fileData);
        });
      }}
    >
      <QueryResultsTable
        columns={columns}
        rowKey="accountId"
        sizingMode="FULL_WIDTH"
        pagination
        externalHeader
        params={paginationParams}
        onChangeParams={setPaginationParams}
        toolsOptions={{
          reload: false,
          setting: false,
          download: true,
        }}
        queryResults={queryResult}
      />
    </Widget>
  );
}

export default TeamSLAPerformanceCard;
