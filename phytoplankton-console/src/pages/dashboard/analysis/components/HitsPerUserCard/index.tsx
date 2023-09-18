/* eslint-disable @typescript-eslint/no-var-requires */
import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import _ from 'lodash';
import { Link } from 'react-router-dom';
import pluralize from 'pluralize';
import { TableItem } from './types';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import UserLink from '@/components/UserLink';
import { getUserName } from '@/utils/api/users';
import { TableColumn } from '@/components/library/Table/types';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { HITS_PER_USER } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { makeUrl } from '@/utils/routing';
import { ColumnHelper } from '@/components/library/Table/columnHelper';

interface Props {
  direction?: 'ORIGIN' | 'DESTINATION';
  userType: 'BUSINESS' | 'CONSUMER';
}

export default function HitsPerUserCard(props: Props) {
  const { direction, userType } = props;
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'week'),
    dayjs(),
  ]);

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
    helper.simple<'rulesHit'>({
      title: 'Rule hit',
      key: 'rulesHit',
      type: {
        render: (rulesHit, { item: entity }) => {
          return <>{`${rulesHit} ${pluralize('hit', rulesHit)} (${entity.percentageRulesHit}%)`}</>;
        },
      },
    }),
    helper.display({
      title: 'Open cases',
      enableResizing: false,
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
              {entity.casesCount} Open {pluralize('case', entity.casesCount)}
            </Link>
          </>
        );
      },
    }),
  ]);

  const hitsPerUserResult = usePaginatedQuery(
    HITS_PER_USER(dateRange, direction),
    async (paginationParams) => {
      let startTimestamp = dayjs().subtract(1, 'day').valueOf();
      let endTimestamp = Date.now();

      const [start, end] = dateRange ?? [];
      if (start != null && end != null) {
        startTimestamp = start.startOf('day').valueOf();
        endTimestamp = end.endOf('day').valueOf();
      }

      const result = await api.getDashboardStatsHitsPerUser({
        ...paginationParams,
        startTimestamp,
        endTimestamp,
        direction,
        userType,
      });

      return {
        total: result.data.length,
        items: result.data,
      };
    },
  );

  return (
    <QueryResultsTable<TableItem>
      rowKey="userId"
      columns={columns}
      extraTools={[() => <DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
      queryResults={hitsPerUserResult}
      pagination={false}
      sizingMode="SCROLL"
      toolsOptions={{
        setting: false,
        reload: true,
      }}
      fitHeight={300}
    />
  );
}
