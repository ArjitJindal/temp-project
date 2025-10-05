import { groupBy } from 'lodash';
import AccountsStatisticsTable from '../AccountsStatisticsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DashboardTeamStatsItem } from '@/apis';
import { map, QueryResult } from '@/utils/queries/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { DURATION } from '@/components/library/Table/standardDataTypes';
import { CommonParams } from '@/components/library/Table/types';
import type { PaginatedData } from '@/utils/queries/hooks';

type AggregatedDashboardTeamStats = {
  role: string;
  users: DashboardTeamStatsItem[];
  totalAssignedTo: number;
  totalClosedBy: number;
  totalClosedBySystem: number;
  totalEscalatedBy: number;
  totalInProgress: number;
  averageInvestigationTime: number;
};

function updateQueryResult(
  queryResult: QueryResult<PaginatedData<DashboardTeamStatsItem>>,
): QueryResult<AggregatedDashboardTeamStats[]> {
  return map(queryResult, (data) => {
    const groupedByRole = groupBy(data.items, 'role');

    const aggregatedData: AggregatedDashboardTeamStats[] = Object.entries(groupedByRole).map(
      ([role, users]) => ({
        role,
        users,
        totalAssignedTo: users.reduce((sum, user) => sum + user.assignedTo, 0),
        totalClosedBy: users.reduce((sum, user) => sum + user.closedBy, 0),
        totalClosedBySystem: users.reduce((sum, user) => sum + (user.closedBySystem ?? 0), 0),
        totalEscalatedBy: users.reduce((sum, user) => sum + (user.escalatedBy ?? 0), 0),
        totalInProgress: users.reduce((sum, user) => sum + (user.inProgress ?? 0), 0),
        averageInvestigationTime:
          users.reduce((sum, user) => sum + (user.investigationTime ?? 0), 0) / users.length,
      }),
    );

    return aggregatedData;
  });
}

const helper = new ColumnHelper<AggregatedDashboardTeamStats>();

const columns = (scope: 'CASES' | 'ALERTS') => {
  return helper.list([
    helper.simple({
      key: 'role',
      title: 'Role',
      defaultWidth: 250,
    }),
    helper.simple({
      key: 'totalAssignedTo',
      title: 'Total Assigned',
      defaultWidth: 100,
    }),
    helper.simple({
      key: 'totalClosedBy',
      title: 'Total Closed',
      defaultWidth: 100,
    }),
    helper.simple({
      key: 'totalClosedBySystem',
      title: 'Total Closed by System',
      defaultWidth: 100,
      tooltip: `Number of ${scope.toLowerCase()} closed by system ${
        scope === 'CASES'
          ? 'where all the alerts were closed by user'
          : 'where case was closed by user'
      }`,
    }),
    helper.simple({
      key: 'totalEscalatedBy',
      title: 'Total Escalated',
      defaultWidth: 100,
    }),
    helper.simple({
      key: 'totalInProgress',
      title: 'Total In Progress',
      defaultWidth: 100,
    }),
    helper.simple({
      key: 'averageInvestigationTime',
      title: 'Average Investigation Time',
      defaultWidth: 100,
      type: DURATION,
    }),
  ]);
};

interface Props {
  queryResult: QueryResult<PaginatedData<DashboardTeamStatsItem>>;
  scope: 'CASES' | 'ALERTS';
  paginationParams: CommonParams;
  setPaginationParams: (paginationParams: CommonParams) => void;
}

export default function CompositeAccountsStatisticsTable(props: Props) {
  const { queryResult, scope, paginationParams, setPaginationParams } = props;

  return (
    <QueryResultsTable<AggregatedDashboardTeamStats>
      columns={columns(scope)}
      rowKey="role"
      sizingMode="FULL_WIDTH"
      pagination={true}
      params={paginationParams}
      onChangeParams={setPaginationParams}
      toolsOptions={{
        reload: false,
        setting: false,
        download: true,
      }}
      queryResults={map(updateQueryResult(queryResult), (data) => ({
        items: data,
        total: data.length,
      }))}
      renderExpanded={(item) => (
        <AccountsStatisticsTable
          queryResult={map(queryResult, (data) => ({
            items: data.items.filter((user) => user.role === item.role),
            total: data.items.filter((user) => user.role === item.role).length,
          }))}
          scope={scope}
          paginationParams={paginationParams}
          setPaginationParams={setPaginationParams}
        />
      )}
      externalHeader={true}
    />
  );
}
