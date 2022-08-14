/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, DatePicker, Tooltip } from 'antd';
import { ActionType, ProColumns } from '@ant-design/pro-table';
import React, { useEffect, useRef, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import moment, { Moment } from 'moment';
import type { ResizeCallbackData } from 'react-resizable';
import { InfoCircleOutlined } from '@ant-design/icons';
import style from '../../style.module.less';
import header from '../dashboardutils';
import { columns } from './consts';
import { TableItem } from './types';
import { useApi } from '@/api';
import Table, { ResponsePayload } from '@/components/ui/Table';
import ResizableTitle from '@/utils/table-utils';
import handleResize from '@/components/ui/Table/utils';
export default function HitsPerUserCard() {
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Moment>>([
    moment().subtract(1, 'week'),
    moment(),
  ]);

  const [updatedColumnWidth, setUpdatedColumnWidth] = useState<{
    [key: number]: number;
  }>({});

  const mergeColumns: ProColumns<TableItem>[] = columns.map((col, index) => ({
    ...col,
    width: updatedColumnWidth[index] || col.width,
    onHeaderCell: (column) => ({
      width: (column as ProColumns<TableItem>).width,
      onResize: handleResize(index, setUpdatedColumnWidth),
    }),
  }));

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
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        className={style.table}
        scroll={{ x: 1300 }}
        headerTitle={header('Top origin users by Rule Hits')}
        rowKey="originUserId"
        tooltip="Origin is the Sender in a transaction"
        search={false}
        columns={mergeColumns}
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
