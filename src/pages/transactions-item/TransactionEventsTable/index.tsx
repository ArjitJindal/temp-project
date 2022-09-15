import React from 'react';
import { TransactionEvent } from '@/apis';
import Table from '@/components/ui/Table';
import Id from '@/components/ui/Id';
import TimestampDisplay from '@/components/ui/TimestampDisplay';

interface Props {
  events: Array<TransactionEvent>;
}

export default function TransactionEventsTable({ events }: Props) {
  return (
    <Table<TransactionEvent>
      rowKey="_id"
      search={false}
      cardBordered={false}
      disableInternalPadding={true}
      columns={[
        {
          title: 'Event ID',
          dataIndex: 'eventId',
          width: 100,
          render: (dom, event) => (event.eventId ? <Id>{event.eventId}</Id> : '-'),
        },
        {
          title: 'Transaction state',
          dataIndex: 'transactionState',
          width: 100,
        },
        {
          title: 'Event Time',
          dataIndex: 'timestamp',
          valueType: 'dateTime',
          key: 'transactionTime',
          width: 100,
          render: (_, item) => {
            return <TimestampDisplay timestamp={item.timestamp} />;
          },
        },
        {
          title: 'Description',
          dataIndex: 'eventDescription',
          width: 100,
        },
        {
          title: 'Reason',
          dataIndex: 'reason',
          width: 100,
        },
      ]}
      data={{
        items: events,
      }}
      pagination={false}
      options={{
        density: false,
        setting: false,
        reload: false,
      }}
    />
  );
}
