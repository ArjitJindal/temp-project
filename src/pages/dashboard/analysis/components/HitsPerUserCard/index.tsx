/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, DatePicker } from 'antd';
import { ActionType } from '@ant-design/pro-table';
import React, { useEffect, useRef, useState } from 'react';
import { RequestData } from '@ant-design/pro-table/lib/typing';
import { RangeValue } from 'rc-picker/lib/interface';
import moment, { Moment } from 'moment';
import { columns } from './consts';
import { TableItem } from './types';
import { useApi } from '@/api';
import Table, { ResponsePayload } from '@/components/ui/Table';
export default function HitsPerUserCard() {
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Moment>>([
    moment().subtract(1, 'week'),
    moment(),
  ]);

  const actionRef = useRef<ActionType>();
  useEffect(() => {
    if (actionRef.current) {
      actionRef.current?.reload();
    }
  }, [dateRange]);

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }}>
      <Table<TableItem>
        actionRef={actionRef}
        form={{
          labelWrap: true,
        }}
        headerTitle="Top origin users (senders) by Rule Hits"
        rowKey="originUserId"
        tooltip="Origin users are the users initiating the transaction - sending the money"
        search={false}
        columns={columns}
        toolBarRender={() => [<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
        request={async (): Promise<ResponsePayload<TableItem>> => {
          let startTimestamp = moment().subtract(1, 'day').valueOf();
          let endTimestamp = Date.now();

          const [start, end] = dateRange ?? [];
          if (start != null && end != null) {
            startTimestamp = start.startOf('day').valueOf();
            endTimestamp = end.endOf('day').valueOf();
          }

          const result = await api.getDashboardStatsHitsPerUser({
            startTimestamp,
            endTimestamp,
          });

          return {
            success: true,
            total: result.data.length,
            data: result.data,
          };
        }}
        defaultSize={'small'}
        pagination={false}
        options={{
          density: false,
          setting: false,
          reload: true,
        }}
      />
    </Card>
  );
}
