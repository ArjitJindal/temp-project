import { ProColumns } from '@ant-design/pro-table';
import { useCallback, useState } from 'react';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Divider, Modal, Tag } from 'antd';
import ProDescriptions from '@ant-design/pro-descriptions';
import { WebhookDeliveryAttempt } from '@/apis';
import { Table } from '@/components/ui/Table';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { useApi } from '@/api';
import Colors from '@/components/ui/colors';

interface Props {
  webhookId: string;
}

// TODO: Make it configurable
const QUERY_LIMIT = 100;

export const WebhookDeliveryAttemptsTable: React.FC<Props> = ({ webhookId }) => {
  const api = useApi();
  const [selectedWebhookDelivery, setSelectedWebhookDelivery] = useState<WebhookDeliveryAttempt>();
  const request = useCallback(async () => {
    const attempts = await api.getWebhooksWebhookIdDeliveries({ webhookId, limit: QUERY_LIMIT });
    return {
      success: true,
      total: attempts.length,
      data: attempts,
    };
  }, [api, webhookId]);
  const columns: ProColumns<WebhookDeliveryAttempt>[] = [
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
    },
    {
      title: 'Event',
      width: 100,
      render: (_, entity) => <Tag color={'cyan'}>{entity.event}</Tag>,
    },
    {
      title: 'Event ID',
      width: 200,
      render: (_, entity) => (
        <a onClick={() => setSelectedWebhookDelivery(entity)}>{entity.deliveryTaskId}</a>
      ),
    },
    {
      title: 'Event Created',
      width: 100,
      render: (_, entity) => <TimestampDisplay timestamp={entity.eventCreatedAt} />,
    },
    {
      title: 'Delivered At',
      width: 100,
      render: (_, entity) => <TimestampDisplay timestamp={entity.requestStartedAt} />,
    },
  ];
  return (
    <>
      <Table<WebhookDeliveryAttempt>
        headerTitle={`last ${QUERY_LIMIT} attempts`}
        columns={columns}
        request={request}
        search={false}
        pagination={false}
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
