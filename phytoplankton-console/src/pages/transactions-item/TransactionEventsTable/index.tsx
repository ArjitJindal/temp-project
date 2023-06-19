import React from 'react';
import { TransactionEvent } from '@/apis';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME, ID, TRANSACTION_STATE } from '@/components/library/Table/standardDataTypes';

interface Props {
  events: Array<TransactionEvent>;
}

export default function TransactionEventsTable({ events }: Props) {
  const columnHelper = new ColumnHelper<TransactionEvent>();
  return (
    <Table<TransactionEvent>
      rowKey="transactionId"
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
      data={{
        items: events,
      }}
      pagination={false}
      toolsOptions={false}
    />
  );
}
