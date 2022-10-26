/* eslint-disable @typescript-eslint/no-var-requires */
import { ActionType } from '@ant-design/pro-table';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import moment, { Moment } from 'moment';
import { Card, DatePicker } from 'antd';
import _ from 'lodash';
import style from '../../style.module.less';
import s from './styles.module.less';
import { TableItem } from './types';
import { useApi } from '@/api';
import { RequestTable } from '@/components/RequestTable';
import UserTypeIcon from '@/components/ui/UserTypeIcon';
import UserLink from '@/components/UserLink';
import { getUserName } from '@/utils/api/users';
import { TableColumn, TableData } from '@/components/ui/Table/types';

interface Props {
  direction?: 'ORIGIN' | 'DESTINATION';
}

export default function HitsPerUserCard(props: Props) {
  const { direction } = props;
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

  const columns: TableColumn<TableItem>[] = [
    {
      title: 'User ID',
      width: 175,
      render: (dom, entity) => {
        const { user, userId } = entity;
        if (!user) {
          return userId;
        }
        return <UserLink user={user}>{userId}</UserLink>;
      },
    },
    {
      title: 'User Name',
      dataIndex: 'user',
      width: 150,
      render: (_, { user }) => getUserName(user),
    },
    {
      title: 'Transactions hit',
      dataIndex: 'transactionsHit',
      width: 100,
      render: (dom, entity) => {
        const { user } = entity;
        if (user == null) {
          return dom;
        }
        return `${entity.transactionsHit} transactions`;
      },
    },
    {
      title: 'User Type',
      width: 80,
      render: (dom, entity) => {
        const { user } = entity;
        if (!user) {
          return '-';
        }
        return (
          <div className={s.userType}>
            <UserTypeIcon type={user.type} /> <span>{_.capitalize(user.type)}</span>
          </div>
        );
      },
    },
  ];

  const request = useCallback(async (): Promise<TableData<TableItem>> => {
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
      direction,
    });

    return {
      success: true,
      total: result.data.length,
      items: result.data,
    };
  }, [api, dateRange, direction]);

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }}>
      <RequestTable<TableItem>
        form={{
          labelWrap: true,
        }}
        className={style.table}
        scroll={{ x: 1300 }}
        rowKey="userId"
        search={false}
        columns={columns}
        toolBarRender={() => [<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
        request={request}
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
