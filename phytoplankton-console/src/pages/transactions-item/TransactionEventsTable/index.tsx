import React, { useState } from 'react';
import { TransactionEvent } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME, ID, TRANSACTION_STATE } from '@/components/library/Table/standardDataTypes';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_EVENTS_FIND } from '@/utils/queries/keys';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { CommonParams } from '@/components/library/Table/types';

interface Props {
  transactionId: string;
}

interface Params extends CommonParams {}

export default function TransactionEventsTable(props: Props) {
  const { transactionId } = props;
  const [params, setParams] = useState<Params>({
    pageSize: DEFAULT_PAGE_SIZE,
    page: 1,
    sort: [],
  });
  const api = useApi();

  const queryResults = usePaginatedQuery(
    TRANSACTIONS_EVENTS_FIND(transactionId, params),
    (params) =>
      api.getTransactionEvents({
        transactionId,
        page: params.page,
        pageSize: params.pageSize,
      }),
  );

  const columnHelper = new ColumnHelper<TransactionEvent>();
  return (
    <QueryResultsTable<TransactionEvent, Params>
      queryResults={queryResults}
      rowKey="eventId"
      params={params}
      onChangeParams={setParams}
      columns={columnHelper.list([
        columnHelper.simple({
          title: 'Event ID',
          key: 'eventId',
          type: ID,
        }),
        columnHelper.simple({
          title: 'Transaction state',
          key: 'transactionState',
          type: TRANSACTION_STATE,
        }),
        columnHelper.simple({
          title: 'Event Time',
          key: 'timestamp',
          type: DATE_TIME,
        }),
        columnHelper.simple({
          title: 'Description',
          key: 'eventDescription',
        }),
        columnHelper.simple({
          title: 'Reason',
          key: 'reason',
        }),
      ])}
      pagination={'HIDE_FOR_ONE_PAGE'}
      toolsOptions={false}
    />
  );
}
