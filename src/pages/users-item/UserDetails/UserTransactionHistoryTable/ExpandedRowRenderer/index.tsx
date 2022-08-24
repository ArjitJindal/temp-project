import { TransactionEvent } from '@/apis';
import { Table } from '@/components/ui/Table';
import Id from '@/components/ui/Id';
import TimestampDisplay from '@/components/ui/TimestampDisplay';

interface Props {
  events: Array<TransactionEvent>;
}

export default function ExpandedRowRenderer(props: Props) {
  const { events } = props;
  return <TransactionEventsTable events={events} />;
}

export const TransactionEventsTable: React.FC<Props> = ({ events }) => {
  return (
    <Table<TransactionEvent>
      rowKey="_id"
      search={false}
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
      dataSource={events}
      pagination={false}
      options={{
        density: false,
        setting: false,
        reload: false,
      }}
    />
  );
};
