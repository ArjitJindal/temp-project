import { ColumnHelper } from '@/components/library/Table/columnHelper';
import AccountTag from '@/components/AccountTag';
import { DashboardTeamStatsItem } from '@/apis';
import { QueryResult } from '@/utils/queries/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { DURATION } from '@/components/library/Table/standardDataTypes';
import { CommonParams } from '@/components/library/Table/types';
import { PaginatedData } from '@/utils/queries/hooks';

const helper = new ColumnHelper<DashboardTeamStatsItem>();

const columns = (scope: 'CASES' | 'ALERTS') => {
  return helper.list([
    helper.simple({
      key: 'accountId',
      title: 'Team member',
      defaultWidth: 250,
      type: {
        render: (accountId) => <AccountTag accountId={accountId} />,
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
  ]);
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
      columns={columns(scope)}
      rowKey="accountId"
      sizingMode="FULL_WIDTH"
      toolsOptions={{
        reload: false,
        setting: false,
        download: false,
      }}
      pagination={true}
      params={paginationParams}
      onChangeParams={setPaginationParams}
      queryResults={queryResult}
    />
  );
}
