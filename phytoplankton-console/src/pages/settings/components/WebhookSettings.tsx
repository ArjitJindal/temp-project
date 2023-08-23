import { Drawer, Switch, Tag, Space } from 'antd';
import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import { WebhookDetails } from './WebhookDetails';
import { WebhookConfiguration, WebhookEventType } from '@/apis';
import { useApi } from '@/api';
import Colors from '@/components/ui/colors';
import Button from '@/components/library/Button';
import { TableColumn, TableRefType } from '@/components/library/Table/types';
import { WEBHOOKS_LIST } from '@/utils/queries/keys';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { message } from '@/components/library/Message';

export const WebhookSettings: React.FC = () => {
  const api = useApi();
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfiguration>();
  const [updatedWebhooks, setUpdatedWebhooks] = useState<{ [key: string]: WebhookConfiguration }>(
    {},
  );
  const actionRef = useRef<TableRefType>(null);
  const handleSaveWebhook = useCallback(
    async (newWebhook: WebhookConfiguration) => {
      const hideMessage = message.loading('Saving...');
      try {
        if (newWebhook._id) {
          setUpdatedWebhooks((prev) => ({
            ...prev,
            [newWebhook._id as string]: newWebhook,
          }));
          await api.postWebhooksWebhookid({
            webhookId: newWebhook._id as string,
            WebhookConfiguration: newWebhook,
          });
        } else {
          await api.postWebhooks({
            WebhookConfiguration: newWebhook,
          });
          setSelectedWebhook(undefined);
          actionRef.current?.reload();
        }
        message.success('Saved');
      } catch (e) {
        message.fatal(`Failed to save`, e);
      } finally {
        hideMessage();
      }
    },
    [api],
  );
  const handleDeleteWebhook = useCallback(
    async (webhook: WebhookConfiguration) => {
      const hideMessage = message.loading('Deleting...');
      try {
        await api.deleteWebhooksWebhookId({ webhookId: webhook._id as string });
        setSelectedWebhook(undefined);
        actionRef.current?.reload();
        message.success('Deleted');
      } catch (e) {
        message.fatal(`Failed to delete`, e);
      } finally {
        hideMessage();
      }
    },
    [api],
  );

  const helper = new ColumnHelper<WebhookConfiguration>();
  const columns: TableColumn<WebhookConfiguration>[] = helper.list([
    helper.derived<WebhookConfiguration>({
      title: 'Endpoint URL',
      value: (entity): WebhookConfiguration | undefined => {
        return updatedWebhooks[entity._id as string] ?? entity;
      },
      type: {
        render: (webhook: WebhookConfiguration | undefined) => {
          return (
            <Link
              to=""
              onClick={() => setSelectedWebhook(webhook)}
              style={{ color: Colors.brandBlue.base }}
            >
              {webhook?.webhookUrl}
            </Link>
          );
        },
      },
    }),
    helper.derived<WebhookConfiguration>({
      title: 'Events',
      value: (entity): WebhookConfiguration | undefined => {
        return updatedWebhooks[entity._id as string] ?? entity;
      },
      type: {
        render: (webhook) => {
          return (
            <>
              {webhook?.events.map((event: WebhookEventType, index) => (
                <Tag color={'cyan'} key={index}>
                  {event}
                </Tag>
              ))}
            </>
          );
        },
        stringify: (row) => row?.events.join(', ') ?? '',
      },
    }),
    helper.derived<WebhookConfiguration>({
      title: 'Activated',
      value: (entity): WebhookConfiguration | undefined => {
        return updatedWebhooks[entity._id as string] ?? entity;
      },
      defaultWidth: 500,
      type: {
        render: (webhook) => {
          return (
            <Space style={{ alignItems: 'baseline' }}>
              <Switch
                checked={webhook?.enabled ?? false}
                onChange={(checked) => {
                  if (webhook) {
                    handleSaveWebhook({ ...webhook, enabled: checked });
                  }
                }}
              />
              {!webhook?.enabled && webhook?.autoDisableMessage && (
                <span>
                  <i>{webhook?.autoDisableMessage}</i>
                </span>
              )}
            </Space>
          );
        },
        stringify: (row) => (row?.enabled ? 'Yes' : 'No'),
      },
    }),
  ]);
  const handleCreateWebhook = useCallback(() => {
    setSelectedWebhook({ webhookUrl: '', events: [], enabled: true });
  }, []);

  const webhooksListResult = usePaginatedQuery(WEBHOOKS_LIST(), async (_paginationParams) => {
    const webhooks = await api.getWebhooks(100);
    return {
      items: webhooks,
      total: webhooks.length,
    };
  });

  return (
    <>
      <QueryResultsTable<WebhookConfiguration>
        rowKey="_id"
        innerRef={actionRef}
        columns={columns}
        pagination={false}
        queryResults={webhooksListResult}
        extraTools={[
          () => (
            <Button type="PRIMARY" onClick={handleCreateWebhook}>
              <PlusOutlined />
              Add endpoint
            </Button>
          ),
        ]}
      />
      <Drawer
        width={960}
        visible={Boolean(selectedWebhook)}
        onClose={() => {
          setSelectedWebhook(undefined);
        }}
        closable={false}
      >
        {selectedWebhook && (
          <WebhookDetails
            webhook={selectedWebhook}
            handleSaveWebhook={handleSaveWebhook}
            handleDeleteWebhook={handleDeleteWebhook}
          />
        )}
      </Drawer>
    </>
  );
};
