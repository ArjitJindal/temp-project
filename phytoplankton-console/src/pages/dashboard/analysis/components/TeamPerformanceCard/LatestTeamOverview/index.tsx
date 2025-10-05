import { useMemo } from 'react';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import AccountTag from '@/components/AccountTag';
import type { DashboardLatestTeamStatsItem } from '@/apis';
import { QueryResult } from '@/utils/queries/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { NUMBER } from '@/components/library/Table/standardDataTypes';
import type { CommonParams } from '@/components/library/Table/types';
import type { PaginatedData } from '@/utils/queries/hooks';
import { getDisplayedUserInfo, useUsers } from '@/utils/user-utils';

interface Props {
  queryResult: QueryResult<PaginatedData<DashboardLatestTeamStatsItem>>;
  paginationParams: CommonParams;
  setPaginationParams: (params: CommonParams) => void;
}

export default function LatestOverviewTable(props: Props) {
  const { queryResult, paginationParams, setPaginationParams } = props;
  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true, includeRootUsers: true });
  const columns = useMemo(() => {
    const helper = new ColumnHelper<DashboardLatestTeamStatsItem>();
    return helper.list([
      helper.simple({
        key: 'accountId',
        title: 'Team member',
        defaultWidth: 250,
        type: {
          render: (accountId) => <AccountTag accountId={accountId} />,
          stringify: (accountId) =>
            (!loadingUsers && users != null && accountId
              ? getDisplayedUserInfo(users[accountId]).name
              : accountId) ?? '',
        },
      }),
      helper.simple({
        key: 'open',
        title: 'Open',
        defaultWidth: 100,
        type: NUMBER,
      }),
      helper.simple({
        key: 'onHold',
        title: 'On Hold',
        defaultWidth: 100,
        type: NUMBER,
      }),
      helper.simple({
        key: 'escalated',
        title: 'Escalated to',
        defaultWidth: 100,
        type: NUMBER,
      }),
      helper.simple({
        key: 'inProgress',
        title: 'In progress',
        defaultWidth: 100,
        type: NUMBER,
      }),
      helper.simple({
        key: 'inReview',
        title: 'In Review',
        defaultWidth: 100,
        type: NUMBER,
      }),
    ]);
  }, [loadingUsers, users]);
  return (
    <QueryResultsTable<DashboardLatestTeamStatsItem>
      columns={columns}
      rowKey="accountId"
      sizingMode="FULL_WIDTH"
      pagination={true}
      params={paginationParams}
      onChangeParams={setPaginationParams}
      toolsOptions={{
        reload: false,
        setting: false,
        download: true,
      }}
      queryResults={queryResult}
      externalHeader={true}
    />
  );
}
