/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, DatePicker } from 'antd';
import ProTable, { ActionType } from '@ant-design/pro-table';
import React, { useEffect, useRef, useState } from 'react';
import { RequestData } from '@ant-design/pro-table/lib/typing';
import { RangeValue } from 'rc-picker/lib/interface';
import moment, { Moment } from 'moment';
import { columns } from './consts';
import { TableItem } from './types';
import { useApi } from '@/api';

export default function HitsPerUserCard() {
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Moment>>(null);

  const actionRef = useRef<ActionType>();
  useEffect(() => {
    if (actionRef.current) {
      actionRef.current?.reload();
    }
  }, [dateRange]);

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }}>
      <ProTable<TableItem>
        actionRef={actionRef}
        form={{
          labelWrap: true,
        }}
        headerTitle="Top users by rules hits"
        rowKey="originUserId"
        search={false}
        columns={columns}
        toolBarRender={() => [<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
        request={async (): Promise<RequestData<TableItem>> => {
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
