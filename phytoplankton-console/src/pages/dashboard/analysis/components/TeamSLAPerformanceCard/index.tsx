import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { AllParams, CommonParams as TableCommonParams } from '@/components/library/Table/types';
import { Dayjs, dayjs } from '@/utils/dayjs';
import { WidgetProps } from '@/components/library/Widget/types';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TEAM_SLA_STATS } from '@/utils/queries/keys';
import { DashboardStatsTeamSLAItem } from '@/apis';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import Widget from '@/components/library/Widget';
import DatePicker from '@/components/ui/DatePicker';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import AccountTag from '@/components/AccountTag';
import { map } from '@/utils/queries/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
interface Params extends TableCommonParams {
  dateRange?: RangeValue<Dayjs>;
}

function TeamSLAPerformanceCard(props: WidgetProps) {
  const startTime = dayjs().subtract(1, 'day').startOf('day');
  const endTime = dayjs().endOf('day');
  const [params, setParams] = useState<AllParams<Params>>({
    ...DEFAULT_PARAMS_STATE,
    dateRange: [startTime, endTime],
  });

  const api = useApi();
  const queryResult = useQuery(
    DASHBOARD_TEAM_SLA_STATS(params),
    async (): Promise<DashboardStatsTeamSLAItem[]> => {
      const [start, end] = params.dateRange ?? [];
      let startTimestamp, endTimestamp;
      if (start != null && end != null) {
        startTimestamp = start.startOf('day').valueOf();
        endTimestamp = end.endOf('day').valueOf();
      }
      const data = await api.getDashboardTeamSlaStats({
        startTimestamp,
        endTimestamp,
      });
      return data;
    },
  );

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

  return (
    <Widget
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
        />,
      ]}
      {...props}
    >
      <QueryResultsTable
        columns={columns}
        rowKey="accountId"
        sizingMode="FULL_WIDTH"
        toolsOptions={{
          reload: false,
          setting: false,
          download: false,
        }}
        queryResults={map(queryResult, (data) => ({
          items: data,
        }))}
      />
    </Widget>
  );
}

export default TeamSLAPerformanceCard;
