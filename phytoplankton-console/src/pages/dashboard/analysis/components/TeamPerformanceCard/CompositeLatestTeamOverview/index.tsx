import { useMemo } from 'react';
import { groupBy } from 'lodash';
import LatestOverviewTable from '../LatestTeamOverview';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DashboardLatestTeamStatsItem } from '@/apis';
import { map, QueryResult } from '@/utils/queries/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { NUMBER } from '@/components/library/Table/standardDataTypes';
import type { PaginatedData } from '@/utils/queries/hooks';
import type { CommonParams } from '@/components/library/Table/types';

type AggregatedLatestTeamStats = {
  role: string;
  users: DashboardLatestTeamStatsItem[];
  totalOpen: number;
  totalOnHold: number;
  totalEscalated: number;
  totalInProgress: number;
  totalInReview: number;
};

interface Props {
  queryResult: QueryResult<PaginatedData<DashboardLatestTeamStatsItem>>;
  paginationParams: CommonParams;
  setPaginationParams: (paginationParams: CommonParams) => void;
}

function updateQueryResult(
  queryResult: QueryResult<PaginatedData<DashboardLatestTeamStatsItem>>,
): QueryResult<AggregatedLatestTeamStats[]> {
  return map(queryResult, (data) => {
    const groupedByRole = groupBy(data.items, 'role');

    return Object.entries(groupedByRole).map(([role, users]) => ({
      role,
      users,
      totalOpen: users.reduce((sum, user) => sum + (user.open ?? 0), 0),
      totalOnHold: users.reduce((sum, user) => sum + (user.onHold ?? 0), 0),
      totalEscalated: users.reduce((sum, user) => sum + (user.escalated ?? 0), 0),
      totalInProgress: users.reduce((sum, user) => sum + (user.inProgress ?? 0), 0),
      totalInReview: users.reduce((sum, user) => sum + (user.inReview ?? 0), 0),
    }));
  });
}

export default function CompositeLatestTeamOverview(props: Props) {
  const { queryResult, paginationParams, setPaginationParams } = props;
  const columns = useMemo(() => {
    const helper = new ColumnHelper<AggregatedLatestTeamStats>();
    return helper.list([
      helper.simple({
        key: 'role',
        title: 'Role',
        defaultWidth: 250,
      }),
      helper.simple({
        key: 'totalOpen',
        title: 'Total Open',
        defaultWidth: 100,
        type: NUMBER,
      }),
      helper.simple({
        key: 'totalOnHold',
        title: 'Total On Hold',
        defaultWidth: 100,
        type: NUMBER,
      }),
      helper.simple({
        key: 'totalEscalated',
        title: 'Total Escalated',
        defaultWidth: 100,
        type: NUMBER,
      }),
      helper.simple({
        key: 'totalInProgress',
        title: 'Total In Progress',
        defaultWidth: 100,
        type: NUMBER,
      }),
      helper.simple({
        key: 'totalInReview',
        title: 'Total In Review',
        defaultWidth: 100,
        type: NUMBER,
      }),
    ]);
  }, []);

  return (
    <QueryResultsTable<AggregatedLatestTeamStats>
      columns={columns}
      rowKey="role"
      sizingMode="FULL_WIDTH"
      toolsOptions={{
        reload: false,
        setting: false,
        download: true,
      }}
      pagination={true}
      params={paginationParams}
      onChangeParams={setPaginationParams}
      queryResults={map(updateQueryResult(queryResult), (data) => ({
        items: data,
      }))}
      renderExpanded={(item) => (
        <LatestOverviewTable
          queryResult={map(queryResult, (data) => ({
            items: data.items.filter((user) => user.role === item.role),
            total: data.items.filter((user) => user.role === item.role).length,
          }))}
          paginationParams={paginationParams}
          setPaginationParams={setPaginationParams}
        />
      )}
    />
  );
}
