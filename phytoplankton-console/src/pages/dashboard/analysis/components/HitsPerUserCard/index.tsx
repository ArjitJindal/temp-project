/* eslint-disable @typescript-eslint/no-var-requires */
import { RangeValue } from 'rc-picker/es/interface';
import { Link } from 'react-router-dom';
import pluralize from 'pluralize';
import { TableItem } from './types';
import { Dayjs } from '@/utils/dayjs';
import UserLink from '@/components/UserLink';
import { getUserName } from '@/utils/api/users';
import { TableColumn } from '@/components/library/Table/types';
import { PaginatedData } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { makeUrl } from '@/utils/routing';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DashboardStatsHitsPerUserData } from '@/apis';
import { QueryResult } from '@/utils/queries/types';

interface Props {
  direction?: 'ORIGIN' | 'DESTINATION';
  userType: 'BUSINESS' | 'CONSUMER';
  dateRange: RangeValue<Dayjs>;
  hitsPerUserResult: QueryResult<PaginatedData<DashboardStatsHitsPerUserData>>;
}

export default function HitsPerUserCard(props: Props) {
  const { dateRange, direction } = props;

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
      title: 'Username',
      value: (entity: TableItem): string => getUserName(entity.user) ?? '',
    }),
    helper.simple<'rulesHit'>({
      title: 'Rule hit',
      key: 'rulesHit',
      type: {
        render: (rulesHit) => {
          return <>{`${rulesHit} ${pluralize('hit', rulesHit)}`}</>;
        },
      },
    }),
    helper.display({
      title: 'Open alerts',
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
              {entity.openCasesCount} Open {pluralize('alert', entity.openCasesCount)}
            </Link>
          </>
        );
      },
    }),
  ]);

  return (
    <QueryResultsTable<TableItem>
      rowKey="userId"
      columns={columns}
      queryResults={props.hitsPerUserResult}
      pagination={false}
      sizingMode="SCROLL"
      toolsOptions={{
        setting: false,
        download: false,
        reload: false,
      }}
      fitHeight={300}
      externalHeader={true}
    />
  );
}
