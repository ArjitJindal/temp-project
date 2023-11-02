/* eslint-disable @typescript-eslint/no-var-requires */
import { RangeValue } from 'rc-picker/es/interface';
import { Link } from 'react-router-dom';
import pluralize from 'pluralize';
import { TableItem } from './types';
import { generateCaseListUrl } from './utils';
import { Dayjs } from '@/utils/dayjs';
import UserLink from '@/components/UserLink';
import { getUserLink, getUserName } from '@/utils/api/users';
import { TableColumn } from '@/components/library/Table/types';
import { PaginatedData } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { getCurrentDomain } from '@/utils/routing';
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
        stringify(value, item) {
          return `${value} (${getCurrentDomain()}${getUserLink(item.user)})`;
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
        stringify(value) {
          return `${value} (${pluralize('hit', value)})`;
        },
      },
    }),
    helper.simple<'openCasesCount'>({
      title: 'Open cases',
      key: 'openCasesCount',
      enableResizing: false,
      type: {
        render: (openCasesCount, { item: entity }) => {
          return (
            <>
              <Link to={generateCaseListUrl(entity.userId!, direction, dateRange)}>
                {entity.openCasesCount} Open {pluralize('case', entity.openCasesCount)}
              </Link>
            </>
          );
        },
        stringify(value, item) {
          return `${value} (${getCurrentDomain()}${generateCaseListUrl(
            item.userId!,
            direction,
            dateRange,
          )})`;
        },
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
