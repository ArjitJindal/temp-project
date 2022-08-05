import moment from 'moment';
import { TransactionEvent } from '@/apis';
import Table from '@/components/ui/Table';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import Id from '@/components/ui/Id';

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
            return moment(item.timestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
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
