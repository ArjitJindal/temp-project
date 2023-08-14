/* eslint-disable @typescript-eslint/no-var-requires */
import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { Card } from 'antd';
import _ from 'lodash';
import { Link } from 'react-router-dom';
import s from './styles.module.less';
import { TableItem } from './types';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import UserTypeIcon from '@/components/ui/UserTypeIcon';
import UserLink from '@/components/UserLink';
import { getUserName } from '@/utils/api/users';
import { TableColumn } from '@/components/library/Table/types';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { HITS_PER_USER } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { makeUrl } from '@/utils/routing';
import { useApiTime } from '@/utils/tracker';
import { ColumnHelper } from '@/components/library/Table/columnHelper';

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

  const helper = new ColumnHelper<TableItem>();
  const columns: TableColumn<TableItem>[] = helper.list([
    helper.simple<'userId'>({
      key: 'userId',
      title: 'User ID',
      type: {
        render: (userId, { item: entity }) => {
          const { user } = entity;
          if (!user) {
            return <>{userId}</>;
          }
          return <UserLink user={user}>{userId}</UserLink>;
        },
      },
    }),
    helper.derived<string>({
      title: 'User name',
      value: (entity: TableItem): string => getUserName(entity.user) ?? '',
    }),
    helper.simple<'transactionsHit'>({
      title: 'Transactions hit',
      key: 'transactionsHit',
      type: {
        render: (transactionsHit, { item: entity }) => {
          return <>{`${transactionsHit} transactions (${entity.percentageTransactionsHit}%)`}</>;
        },
      },
    }),
    helper.simple<'user.type'>({
      key: 'user.type',
      title: 'User type',
      type: {
        render: (type) => {
          if (!type) {
            return <>-</>;
          }
          return (
            <div className={s.userType}>
              <UserTypeIcon type={type} /> <span>{_.capitalize(type)}</span>
            </div>
          );
        },
      },
    }),
    helper.display({
      title: 'Open cases',
      render: (entity) => {
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
              {entity.casesCount} Cases
            </Link>
          </>
        );
      },
    }),
  ]);

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
    <Card bordered={false}>
      <QueryResultsTable<TableItem>
        rowKey="userId"
        columns={columns}
        extraTools={[() => <DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
        queryResults={hitsPerUserResult}
        pagination={false}
        sizingMode="FULL_WIDTH"
        toolsOptions={{
          setting: false,
          reload: true,
        }}
      />
    </Card>
  );
}
