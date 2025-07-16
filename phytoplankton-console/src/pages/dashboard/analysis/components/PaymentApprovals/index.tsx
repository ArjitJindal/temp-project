import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { getCsvData } from '../../utils/export-data-build-util';
import { WidgetProps } from '@/components/library/Widget/types';
import Widget from '@/components/library/Widget';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import DatePicker from '@/components/ui/DatePicker';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { Dayjs, dayjs } from '@/utils/dayjs';
import {
  AllParams,
  CommonParams as TableCommonParams,
  TableData,
} from '@/components/library/Table/types';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { useUsers } from '@/utils/user-utils';
import { DASHBOARD_TEAM_PAYMENT_APPROVALS } from '@/utils/queries/keys';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DashboardStatsPaymentApprovals } from '@/apis';
import { getDuration, formatDuration } from '@/utils/time-utils';
import { getOr } from '@/utils/asyncResource';

interface Params extends TableCommonParams {
  dateRange?: RangeValue<Dayjs>;
}

function PaymentApprovals(props: WidgetProps) {
  const [users] = useUsers({ includeBlockedUsers: true, includeRootUsers: true });
  const startTime = dayjs().subtract(1, 'month');
  const endTime = dayjs();
  const [params, setParams] = useState<AllParams<Params>>({
    ...DEFAULT_PARAMS_STATE,
    dateRange: [startTime, endTime],
  });

  const api = useApi();
  const queryResult = useQuery(
    DASHBOARD_TEAM_PAYMENT_APPROVALS({ ...params }),
    async (): Promise<TableData<DashboardStatsPaymentApprovals>> => {
      const [start, end] = params.dateRange ?? [];
      let startTimestamp, endTimestamp;
      if (start != null && end != null) {
        startTimestamp = start.startOf('day').valueOf();
        endTimestamp = end.endOf('day').valueOf();
      }
      const response = await api.getDashboardStatsPaymentApprovals({
        startTimestamp,
        endTimestamp,
      });
      return { items: response.items ?? [] };
    },
  );
  const helper = new ColumnHelper<DashboardStatsPaymentApprovals>();
  const columns = helper.list([
    helper.display({
      title: 'Team member',
      defaultWidth: 100,
      render: ({ accountId }) => {
        return users?.[accountId]?.name ?? users?.[accountId]?.email ?? accountId;
      },
    }),
    helper.simple({
      key: 'approved',
      title: 'Approved',
      defaultWidth: 100,
    }),
    helper.simple({
      key: 'blocked',
      title: 'Blocked',
      defaultWidth: 100,
    }),
    helper.display({
      title: 'Avg. decision time',
      defaultWidth: 100,
      render: ({ averageDecisionTime }) => {
        const time =
          averageDecisionTime != null ? formatDuration(getDuration(averageDecisionTime)) : '0';
        return time;
      },
    }),
  ]);
  const dataToExport = (items: DashboardStatsPaymentApprovals[]) => {
    return items.map((item) => ({
      'Team Member': users[item.accountId]?.name || item.accountId,
      Approved: item.approved,
      Blocked: item.blocked,
      'Average decision time': item.averageDecisionTime,
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
            fileName: `payment-approvals-${dayjs().format('YYYY-MM-DD')}.csv`,
            data: getCsvData(
              dataToExport(getOr(queryResult.data as any, { items: [], total: 0 }).items),
            ),
          };
          resolve(fileData);
        });
      }}
    >
      <QueryResultsTable
        columns={columns}
        queryResults={queryResult}
        rowKey="accountId"
        sizingMode="FULL_WIDTH"
        pagination
        externalHeader
        params={params}
        onChangeParams={setParams}
        toolsOptions={{
          reload: false,
          setting: false,
          download: true,
        }}
      />
    </Widget>
  );
}

export default PaymentApprovals;
