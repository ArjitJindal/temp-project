import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { Assignee } from '@/components/Assignee';
import { DashboardTeamStatsItem } from '@/apis';
import { map, QueryResult } from '@/utils/queries/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';

const helper = new ColumnHelper<DashboardTeamStatsItem>();

const columns = helper.list([
  helper.simple({
    key: 'accountId',
    title: 'Team member',
    defaultWidth: 250,
    type: {
      render: (accountId) => <Assignee accountId={accountId} />,
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
]);

interface Props {
  queryResult: QueryResult<DashboardTeamStatsItem[]>;
}

export default function AccountsStatisticsTable(props: Props) {
  const { queryResult } = props;
  return (
    <QueryResultsTable<DashboardTeamStatsItem>
      columns={columns}
      rowKey="accountId"
      sizingMode="FULL_WIDTH"
      toolsOptions={{
        reload: false,
        setting: false,
        download: false,
      }}
      queryResults={map(queryResult, (data) => ({
        items: data,
      }))}
    />
  );
}
