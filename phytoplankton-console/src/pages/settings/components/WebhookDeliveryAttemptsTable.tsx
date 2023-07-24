import { useState } from 'react';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import ProDescriptions from '@ant-design/pro-descriptions';
import { WebhookDeliveryAttempt } from '@/apis';
import { useApi } from '@/api';
import Colors from '@/components/ui/colors';
import { TableColumn } from '@/components/library/Table/types';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { WEBHOOKS } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME } from '@/components/library/Table/standardDataTypes';
import Modal from '@/components/library/Modal';

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
  const helper = new ColumnHelper<WebhookDeliveryAttempt>();
  const columns: TableColumn<WebhookDeliveryAttempt>[] = helper.list([
    helper.simple<'success'>({
      key: 'success',
      title: 'Status',
      type: {
        render: (success) =>
          success ? (
            <CheckCircleOutlined style={{ color: Colors.successColor.base }} />
          ) : (
            <CloseCircleOutlined style={{ color: Colors.errorColor.base }} />
          ),
        stringify: (success) => (success ? 'Success' : 'Failed'),
      },
    }),
    helper.simple<'event'>({
      key: 'event',
      title: 'Event',
      type: {
        render: (event) => (event ? <Tag color={'cyan'}>{event}</Tag> : <></>),
      },
    }),
    helper.simple<'deliveryTaskId'>({
      key: 'deliveryTaskId',
      title: 'Event ID',
      type: {
        render: (deliveryTaskId, { item: entity }) => (
          <a onClick={() => setSelectedWebhookDelivery(entity)}>{deliveryTaskId}</a>
        ),
      },
    }),
    helper.simple<'eventCreatedAt'>({
      key: 'eventCreatedAt',
      title: 'Event Created',
      type: DATE_TIME,
    }),
    helper.simple<'requestStartedAt'>({
      key: 'requestStartedAt',
      title: 'Delivered At',
      type: DATE_TIME,
    }),
  ]);
  return (
    <>
      <QueryResultsTable<WebhookDeliveryAttempt>
        // headerTitle={`last ${QUERY_LIMIT} attempts`}
        rowKey="deliveryTaskId"
        columns={columns}
        queryResults={webhookResults}
        pagination={false}
      />
      <Modal
        isOpen={Boolean(selectedWebhookDelivery)}
        onCancel={() => setSelectedWebhookDelivery(undefined)}
        hideFooter
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
