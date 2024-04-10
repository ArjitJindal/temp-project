import { useMemo } from 'react';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import AccountTag from '@/components/AccountTag';
import { DashboardLatestTeamStatsItem } from '@/apis';
import { map, QueryResult } from '@/utils/queries/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { NUMBER } from '@/components/library/Table/standardDataTypes';

interface Props {
  queryResult: QueryResult<DashboardLatestTeamStatsItem[]>;
}

export default function LatestOverviewTable(props: Props) {
  const { queryResult } = props;
  const columns = useMemo(() => {
    const helper = new ColumnHelper<DashboardLatestTeamStatsItem>();
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
  }, []);
  return (
    <QueryResultsTable<DashboardLatestTeamStatsItem>
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
