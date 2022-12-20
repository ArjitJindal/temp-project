import { useState } from 'react';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Modal, Tag } from 'antd';
import ProDescriptions from '@ant-design/pro-descriptions';
import { WebhookDeliveryAttempt } from '@/apis';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { useApi } from '@/api';
import Colors from '@/components/ui/colors';
import { TableColumn } from '@/components/ui/Table/types';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { WEBHOOKS } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';

interface Props {
  webhookId: string;
}

// TODO: Make it configurable
const QUERY_LIMIT = 100;

export const WebhookDeliveryAttemptsTable: React.FC<Props> = ({ webhookId }) => {
  const api = useApi();
  const [selectedWebhookDelivery, setSelectedWebhookDelivery] = useState<WebhookDeliveryAttempt>();
  const webhookResults = usePaginatedQuery(WEBHOOKS(webhookId), async () => {
    const attempts = await api.getWebhooksWebhookIdDeliveries({ webhookId, pageSize: QUERY_LIMIT });
    return {
      total: attempts.length,
      items: attempts,
    };
  });
  const columns: TableColumn<WebhookDeliveryAttempt>[] = [
    {
      title: 'Status',
      width: 30,
      align: 'center',
      render: (_, entity) =>
        entity.success ? (
          <CheckCircleOutlined style={{ color: Colors.successColor.base }} />
        ) : (
          <CloseCircleOutlined style={{ color: Colors.errorColor.base }} />
        ),
      exportData: (entity) => (entity.success ? 'Success' : 'Failed'),
    },
    {
      title: 'Event',
      width: 100,
      render: (_, entity) => <Tag color={'cyan'}>{entity.event}</Tag>,
      exportData: (entity) => entity.event,
    },
    {
      title: 'Event ID',
      width: 200,
      render: (_, entity) => (
        <a onClick={() => setSelectedWebhookDelivery(entity)}>{entity.deliveryTaskId}</a>
      ),
      exportData: (entity) => entity.deliveryTaskId,
    },
    {
      title: 'Event Created',
      width: 100,
      render: (_, entity) => <TimestampDisplay timestamp={entity.eventCreatedAt} />,
      exportData: (entity) => dayjs(entity.eventCreatedAt).format(DEFAULT_DATE_TIME_FORMAT),
    },
    {
      title: 'Delivered At',
      width: 100,
      render: (_, entity) => <TimestampDisplay timestamp={entity.requestStartedAt} />,
      exportData: (entity) => dayjs(entity.requestStartedAt).format(DEFAULT_DATE_TIME_FORMAT),
    },
  ];
  return (
    <>
      <QueryResultsTable<WebhookDeliveryAttempt>
        headerTitle={`last ${QUERY_LIMIT} attempts`}
        columns={columns}
        queryResults={webhookResults}
        search={false}
        pagination={false}
        rowKey="deliveryTaskId"
      />
      <Modal
        visible={Boolean(selectedWebhookDelivery)}
        onCancel={() => setSelectedWebhookDelivery(undefined)}
        footer={null}
      >
        <ProDescriptions column={1}>
          <ProDescriptions.Item>Request</ProDescriptions.Item>
          <ProDescriptions.Item valueType="jsonCode">
            {JSON.stringify(selectedWebhookDelivery?.request)}
          </ProDescriptions.Item>
          <ProDescriptions.Item>Response</ProDescriptions.Item>
          <ProDescriptions.Item valueType="jsonCode">
            {JSON.stringify(selectedWebhookDelivery?.response)}
          </ProDescriptions.Item>
        </ProDescriptions>
      </Modal>
    </>
  );
};
