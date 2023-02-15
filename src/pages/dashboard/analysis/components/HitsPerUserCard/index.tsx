/* eslint-disable @typescript-eslint/no-var-requires */
import { ActionType } from '@ant-design/pro-table';
import React, { useEffect, useRef, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { Card } from 'antd';
import _ from 'lodash';
import { Link } from 'react-router-dom';
import style from '../../style.module.less';
import s from './styles.module.less';
import { TableItem } from './types';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import UserTypeIcon from '@/components/ui/UserTypeIcon';
import UserLink from '@/components/UserLink';
import { getUserName } from '@/utils/api/users';
import { TableColumn } from '@/components/ui/Table/types';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { HITS_PER_USER } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { makeUrl } from '@/utils/routing';
import { useApiTime } from '@/utils/tracker';

interface Props {
  direction?: 'ORIGIN' | 'DESTINATION';
}

export default function HitsPerUserCard(props: Props) {
  const { direction } = props;
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'week'),
    dayjs(),
  ]);

  const measure = useApiTime();

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
      exportData: (entity) => {
        return entity?.userId;
      },
    },
    {
      title: 'User Name',
      dataIndex: 'user',
      width: 150,
      render: (_, { user }) => getUserName(user),
      exportData: (entity) => {
        const { user } = entity;
        return getUserName(user);
      },
    },
    {
      title: 'Transactions hit',
      dataIndex: 'transactionsHit',
      width: 100,
      render: (dom, entity) => {
        return `${entity.transactionsHit} transactions (${entity.percentageTransactionsHit}%)`;
      },
      exportData: (entity) => {
        return entity?.transactionsHit;
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
      exportData: (entity) => {
        const { user } = entity;
        if (!user) {
          return '-';
        }
        return user.type;
      },
    },
    {
      title: 'Open Cases',
      width: 100,
      render: (dom, entity) => {
        let startTimestamp;
        let endTimestamp;
        const [start, end] = dateRange ?? [];
        if (start != null && end != null) {
          startTimestamp = start.startOf('day').valueOf();
          endTimestamp = end.endOf('day').valueOf();
        }
        return (
          <>
            <Link
              to={makeUrl(
                '/case-management/cases',
                {},
                {
                  userId: entity.userId,
                  userFilterMode: direction ? direction : 'ALL',
                  createdTimestamp: `${startTimestamp},${endTimestamp}`,
                },
              )}
            >
              {entity.openUserCasesCount} Cases
            </Link>
          </>
        );
      },
    },
  ];

  const hitsPerUserResult = usePaginatedQuery(HITS_PER_USER(dateRange, direction), async () => {
    let startTimestamp = dayjs().subtract(1, 'day').valueOf();
    let endTimestamp = Date.now();

    const [start, end] = dateRange ?? [];
    if (start != null && end != null) {
      startTimestamp = start.startOf('day').valueOf();
      endTimestamp = end.endOf('day').valueOf();
    }

    const result = await measure(
      () =>
        api.getDashboardStatsHitsPerUser({
          startTimestamp,
          endTimestamp,
          direction,
        }),
      'Dashboard Stats Hits Per User',
    );

    return {
      total: result.data.length,
      items: result.data,
    };
  });

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }}>
      <QueryResultsTable<TableItem>
        form={{
          labelWrap: true,
        }}
        className={style.table}
        scroll={{ x: 1300 }}
        rowKey="userId"
        search={false}
        columns={columns}
        toolBarRender={() => [<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
        queryResults={hitsPerUserResult}
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
