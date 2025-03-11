import { useState, useCallback } from 'react';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { message } from 'antd';
import { useMutation } from '@tanstack/react-query';
import s from './style.module.less';
import WebhookActionMenu from './WebhookActionMenu';
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
import Button from '@/components/library/Button';
import { CloseMessage } from '@/components/library/Message';
import Table from '@/components/library/Table';
import RestartLineIcon from '@/components/ui/icons/Remix/system/restart-line.react.svg';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import SearchIcon from '@/components/ui/icons/Remix/system/search-2-line.react.svg';

interface Props {
  webhookId: string;
}

interface Params extends CommonParams {
  success?: 'Success' | 'Failed';
  event?: WebhookEventType;
  eventCreatedAt?: [string, string];
  requestStartedAt?: [string, string];
  searchEntityId?: string;
}

export const WebhookDeliveryAttemptsTable: React.FC<Props> = ({ webhookId }) => {
  const api = useApi();
  const [selectedWebhookDelivery, setSelectedWebhookDelivery] = useState<WebhookDeliveryAttempt>();
  const [showDeliveryAttemptsModal, setShowDeliveryAttemptsModal] = useState(false);
  const [deliveryAttempts, setDeliveryAttempts] = useState<WebhookDeliveryAttempt[]>([]);
  let hide: CloseMessage | undefined;

  const resendMutation = useMutation<
    { success: boolean; error?: string },
    unknown,
    { deliveryTaskId: string }
  >(
    async (payload) => {
      const response = await api.postWebhookEventResend(payload);
      return {
        success: response.success ?? false,
        error: response?.error,
      };
    },
    {
      onSuccess: (response) => {
        if (response.success) {
          message.success('Webhook called successfully');
        } else {
          message.error('Failed to call webhook: ' + response.error);
        }
        hide?.();
      },
      onError: (_e) => {
        message.error('Failed to call webhook');
        hide?.();
      },
      onMutate: () => {
        hide = message.loading('Sending webhook...');
      },
    },
  );

  const [params, setParams] = useState<Params>({
    ...DEFAULT_PARAMS_STATE,
  });

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
        searchEntityId: params.searchEntityId ? [params.searchEntityId] : [],
      });

      return attempts;
    },
  );
  const handleReplayWebhook = useCallback(
    (event: WebhookDeliveryAttempt) => {
      if (!event.deliveryTaskId) {
        return;
      }
      resendMutation.mutate(
        { deliveryTaskId: event.deliveryTaskId },
        {
          onSuccess: () => {
            webhookResults.refetch();
          },
        },
      );
    },
    [resendMutation, webhookResults],
  );
  const helper = new ColumnHelper<WebhookDeliveryAttempt>();

  const columns: TableColumn<WebhookDeliveryAttempt>[] = helper.list([
    helper.simple<'overallSuccess'>({
      key: 'overallSuccess',
      title: 'Status',
      filtering: true,
      defaultWidth: 64,
      type: {
        render: (overallSuccess) =>
          overallSuccess ? (
            <CheckCircleOutlined style={{ color: Colors.successColor.base }} />
          ) : (
            <CloseCircleOutlined style={{ color: Colors.errorColor.base }} />
          ),
        stringify: (overallSuccess) => (overallSuccess ? 'Success' : 'Failed'),
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
    helper.display({
      title: 'Actions',
      defaultSticky: 'RIGHT',
      render: (_, { item: entity }) => (
        <div className={s.actionsContainer}>
          <Button
            type="SECONDARY"
            size="SMALL"
            onClick={() => handleReplayWebhook(entity)}
            icon={<RestartLineIcon />}
            isLoading={
              resendMutation.isLoading &&
              resendMutation.variables?.deliveryTaskId === entity.deliveryTaskId
            }
          >
            Replay
          </Button>
          <div className={s.actionIconsContainer}>
            <WebhookActionMenu
              deliveryAttempts={entity?.attempts ?? []}
              setShowDeliveryAttemptsModal={setShowDeliveryAttemptsModal}
              setDeliveryAttempts={setDeliveryAttempts}
            />
          </div>
        </div>
      ),
    }),
  ]);

  const extraFilters: ExtraFilterProps<Params>[] = [
    {
      title: 'Entity ID',
      key: 'searchEntityId',
      renderer: { kind: 'string' },
      showFilterByDefault: true,
      icon: <SearchIcon />,
    },
  ];

  return (
    <>
      <QueryResultsTable<WebhookDeliveryAttempt, Params>
        rowKey="deliveryTaskId"
        columns={columns}
        queryResults={webhookResults}
        pagination={true}
        params={params}
        onChangeParams={setParams}
        extraFilters={extraFilters}
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
      <Modal
        isOpen={showDeliveryAttemptsModal}
        title="Delivery attempts"
        onCancel={() => setShowDeliveryAttemptsModal(false)}
        hideFooter
      >
        <Table<WebhookDeliveryAttempt>
          sizingMode="FULL_WIDTH"
          pagination={false}
          toolsOptions={false}
          hideFilters={true}
          tableId="delivery-attempts"
          rowKey="deliveryTaskId"
          columns={helper.list([
            helper.simple<'success'>({
              key: 'success',
              title: 'Status',
              filtering: true,
              // defaultWidth: 64,
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
            helper.simple<'requestStartedAt'>({
              key: 'requestStartedAt',
              title: 'Delivered At',
              type: DATE_TIME,
              filtering: true,
            }),
            helper.display({
              title: 'Response',
              render: (_, { item: entity }) => (
                <Button
                  type="SECONDARY"
                  size="SMALL"
                  onClick={() => setSelectedWebhookDelivery(entity)}
                >
                  View
                </Button>
              ),
            }),
          ])}
          data={{
            total: deliveryAttempts.length,
            items: deliveryAttempts,
          }}
        />
      </Modal>
    </>
  );
};
