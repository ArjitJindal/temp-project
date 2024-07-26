import { useState } from 'react';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { WebhookDeliveryAttempt } from '@/apis';
import { useApi } from '@/api';
import Colors, { COLORS_V2_GRAY_1 } from '@/components/ui/colors';
import { TableColumn } from '@/components/library/Table/types';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { WEBHOOKS } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME } from '@/components/library/Table/standardDataTypes';
import Modal from '@/components/library/Modal';
import Tag from '@/components/library/Tag';
import Label from '@/components/library/Label';

interface Props {
  webhookId: string;
}

// TODO: Make it configurable
const QUERY_LIMIT = 100;

export const WebhookDeliveryAttemptsTable: React.FC<Props> = ({ webhookId }) => {
  const api = useApi();
  const [selectedWebhookDelivery, setSelectedWebhookDelivery] = useState<WebhookDeliveryAttempt>();
  const webhookResults = usePaginatedQuery(WEBHOOKS(webhookId), async (paginationParams) => {
    const attempts = await api.getWebhooksWebhookIdDeliveries({
      webhookId,
      pageSize: QUERY_LIMIT,
      ...paginationParams,
    });
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
        <Label label="Request">
          <pre
            style={{
              background: COLORS_V2_GRAY_1,
              padding: '8px',
              borderRadius: '8px',
              maxHeight: '250px',
            }}
          >
            {JSON.stringify(selectedWebhookDelivery?.request, null, 4)}
          </pre>
        </Label>
        <Label label="Response">
          <pre
            style={{
              background: COLORS_V2_GRAY_1,
              padding: '8px',
              borderRadius: '8px',
              maxHeight: '250px',
            }}
          >
            {JSON.stringify(selectedWebhookDelivery?.response, null, 4)}
          </pre>
        </Label>
      </Modal>
    </>
  );
};
