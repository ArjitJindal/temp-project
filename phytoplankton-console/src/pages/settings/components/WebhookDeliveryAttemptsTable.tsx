import { useState } from 'react';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { WebhookDeliveryAttempt, WebhookEventType } from '@/apis';
import { useApi } from '@/api';
import Colors, { COLORS_V2_GRAY_1 } from '@/components/ui/colors';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { WEBHOOKS } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME } from '@/components/library/Table/standardDataTypes';
import Modal from '@/components/library/Modal';
import Tag from '@/components/library/Tag';
import Label from '@/components/library/Label';
import { DEFAULT_PAGE_SIZE, DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { WEBHOOK_EVENT_TYPES } from '@/apis/models-custom/WebhookEventType';
import { dayjs } from '@/utils/dayjs';

interface Props {
  webhookId: string;
}

interface Params extends CommonParams {
  success?: 'Success' | 'Failed';
  event?: WebhookEventType;
  eventCreatedAt?: [string, string];
  requestStartedAt?: [string, string];
}

export const WebhookDeliveryAttemptsTable: React.FC<Props> = ({ webhookId }) => {
  const api = useApi();

  const [params, setParams] = useState<Params>({
    ...DEFAULT_PARAMS_STATE,
  });

  const [selectedWebhookDelivery, setSelectedWebhookDelivery] = useState<WebhookDeliveryAttempt>();
  const webhookResults = usePaginatedQuery(
    WEBHOOKS(webhookId, params),
    async (paginationParams) => {
      const { page = 1, pageSize = DEFAULT_PAGE_SIZE } = params;
      const attempts = await api.getWebhooksWebhookIdDeliveries({
        webhookId,
        page,
        pageSize,
        ...paginationParams,
        ...(params.success != null && {
          filterStatus: params.success === 'Success' ? 'true' : 'false',
        }),
        filterEventType: params.event,
        filterEventCreatedAtAfterTimestamp: params.eventCreatedAt?.[0]
          ? dayjs(params.eventCreatedAt[0]).valueOf()
          : undefined,
        filterEventCreatedAtBeforeTimestamp: params.eventCreatedAt?.[1]
          ? dayjs(params.eventCreatedAt[1]).valueOf()
          : undefined,
        filterEventDeliveredAtAfterTimestamp: params.requestStartedAt?.[0]
          ? dayjs(params.requestStartedAt[0]).valueOf()
          : undefined,
        filterEventDeliveredAtBeforeTimestamp: params.requestStartedAt?.[1]
          ? dayjs(params.requestStartedAt[1]).valueOf()
          : undefined,
      });

      return attempts;
    },
  );

  const helper = new ColumnHelper<WebhookDeliveryAttempt>();

  const columns: TableColumn<WebhookDeliveryAttempt>[] = helper.list([
    helper.simple<'success'>({
      key: 'success',
      title: 'Status',
      filtering: true,
      type: {
        render: (success) =>
          success ? (
            <CheckCircleOutlined style={{ color: Colors.successColor.base }} />
          ) : (
            <CloseCircleOutlined style={{ color: Colors.errorColor.base }} />
          ),
        stringify: (success) => (success ? 'Success' : 'Failed'),
        autoFilterDataType: {
          kind: 'select',
          options: [
            { value: 'Success', label: 'Success' },
            { value: 'Failed', label: 'Failed' },
          ],
          mode: 'SINGLE',
          displayMode: 'select',
        },
      },
    }),
    helper.simple<'event'>({
      key: 'event',
      title: 'Event',
      filtering: true,
      type: {
        render: (event) => (event ? <Tag color={'cyan'}>{event}</Tag> : <></>),
        autoFilterDataType: {
          kind: 'select',
          options: Object.values(WEBHOOK_EVENT_TYPES).map((event) => ({
            value: event,
            label: humanizeConstant(event),
          })),
          mode: 'SINGLE',
          displayMode: 'list',
        },
      },
    }),
    helper.simple<'deliveryTaskId'>({
      key: 'deliveryTaskId',
      title: 'Event ID',
      type: {
        render: (deliveryTaskId, { item: entity }) => (
          <a
            onClick={(e) => {
              e.preventDefault();
              setSelectedWebhookDelivery(entity);
            }}
          >
            {deliveryTaskId}
          </a>
        ),
      },
    }),
    helper.simple<'eventCreatedAt'>({
      key: 'eventCreatedAt',
      title: 'Event Created',
      type: DATE_TIME,
      filtering: true,
    }),
    helper.simple<'requestStartedAt'>({
      key: 'requestStartedAt',
      title: 'Delivered At',
      type: DATE_TIME,
      filtering: true,
    }),
  ]);

  return (
    <>
      <QueryResultsTable<WebhookDeliveryAttempt, Params>
        rowKey="deliveryTaskId"
        columns={columns}
        queryResults={webhookResults}
        pagination={true}
        params={params}
        onChangeParams={setParams}
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
