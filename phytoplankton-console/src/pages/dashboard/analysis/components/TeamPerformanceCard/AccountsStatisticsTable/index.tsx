import { useMemo } from 'react';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import AccountTag from '@/components/AccountTag';
import { DashboardTeamStatsItem } from '@/apis';
import type { QueryResult } from '@/utils/queries/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { DURATION } from '@/components/library/Table/standardDataTypes';
import { CommonParams } from '@/components/library/Table/types';
import type { PaginatedData } from '@/utils/queries/hooks';
import { getDisplayedUserInfo, useUsers } from '@/utils/user-utils';

const helper = new ColumnHelper<DashboardTeamStatsItem>();

const useColumns = (scope: 'CASES' | 'ALERTS') => {
  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true, includeRootUsers: true });

  return useMemo(
    () =>
      helper.list([
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
          key: 'assignedTo',
          title: 'Assigned to',
          defaultWidth: 100,
        }),
        helper.simple({
          key: 'closedBy',
          title: 'Closed by',
          defaultWidth: 100,
        }),

        helper.simple({
          key: 'closedBySystem',
          title: 'Closed by system',
          defaultWidth: 100,
          tooltip: `Number of ${scope.toLowerCase()} closed by system ${
            scope === 'CASES'
              ? 'where all the alerts were closed by user'
              : 'where case was closed by user'
          }`,
        }),
        helper.simple({
          key: 'escalatedBy',
          title: 'Escalated by',
          defaultWidth: 100,
        }),
        helper.simple({
          key: 'inProgress',
          title: 'In progress',
          defaultWidth: 100,
        }),
        helper.simple({
          key: 'investigationTime',
          title: 'Average investigation time',
          defaultWidth: 100,
          type: DURATION,
        }),
      ]),
    [users, loadingUsers, scope],
  );
};

interface Props {
  queryResult: QueryResult<PaginatedData<DashboardTeamStatsItem>>;
  scope: 'CASES' | 'ALERTS';
  paginationParams: CommonParams;
  setPaginationParams: (paginationParams: CommonParams) => void;
}

export default function AccountsStatisticsTable(props: Props) {
  const { queryResult, scope, paginationParams, setPaginationParams } = props;

  return (
    <QueryResultsTable<DashboardTeamStatsItem>
      columns={useColumns(scope)}
      rowKey="accountId"
      sizingMode="FULL_WIDTH"
      toolsOptions={{
        reload: false,
        setting: false,
        download: true,
      }}
      pagination={true}
      params={paginationParams}
      onChangeParams={setPaginationParams}
      queryResults={queryResult}
      externalHeader={true}
    />
  );
}
