import { ProColumns } from '@ant-design/pro-table';
import { Drawer, message, Switch, Tag } from 'antd';
import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import { WebhookDetails } from './WebhookDetails';
import { Table, TableActionType } from '@/components/ui/Table';
import { WebhookConfiguration, WebhookEvent } from '@/apis';
import { useApi } from '@/api';
import Colors from '@/components/ui/colors';
import Button from '@/components/ui/Button';

export const WebhookSettings: React.FC = () => {
  const api = useApi();
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfiguration>();
  const [updatedWebhooks, setUpdatedWebhooks] = useState<{ [key: string]: WebhookConfiguration }>(
    {},
  );
  const actionRef = useRef<TableActionType>(null);
  const handleSaveWebhook = useCallback(
    async (newWebhook: WebhookConfiguration) => {
      const hideMessage = message.loading('Saving...', 0);
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
        message.error(`Failed to save`);
      } finally {
        hideMessage();
      }
    },
    [api],
  );
  const handleDeleteWebhook = useCallback(
    async (webhook: WebhookConfiguration) => {
      const hideMessage = message.loading('Deleting...', 0);
      try {
        await api.deleteWebhooksWebhookId({ webhookId: webhook._id as string });
        setSelectedWebhook(undefined);
        actionRef.current?.reload();
        message.success('Deleted');
      } catch (e) {
        message.error(`Failed to delete`);
      } finally {
        hideMessage();
      }
    },
    [api],
  );

  const columns: ProColumns<WebhookConfiguration>[] = [
    {
      title: 'Endpoint URL',
      width: 200,
      render: (_, entity) => {
        const webhook = updatedWebhooks[entity._id as string] ?? entity;
        return (
          <Link
            to=""
            onClick={() => setSelectedWebhook(webhook)}
            style={{ color: Colors.brandBlue.base }}
          >
            {webhook.webhookUrl}
          </Link>
        );
      },
    },
    {
      title: 'Events',
      width: 200,
      render: (_, entity) => {
        const webhook = updatedWebhooks[entity._id as string] ?? entity;
        return (
          <>
            {webhook.events.map((event: WebhookEvent, index) => (
              <Tag color={'cyan'} key={index}>
                {event}
              </Tag>
            ))}
          </>
        );
      },
    },
    {
      title: 'Activated',
      hideInDescriptions: true,
      width: 30,
      render: (_, entity) => {
        const webhook = updatedWebhooks[entity._id as string] ?? entity;
        return (
          <Switch
            checked={webhook.enabled}
            onChange={(checked) => handleSaveWebhook({ ...webhook, enabled: checked })}
          />
        );
      },
    },
  ];
  const handleCreateWebhook = useCallback(() => {
    setSelectedWebhook({ webhookUrl: '', events: [], enabled: true });
  }, [setSelectedWebhook]);
  const request = useCallback(async () => {
    const webhooks = await api.getWebhooks(100);
    return {
      data: webhooks,
      success: true,
      total: webhooks.length,
    };
  }, [api]);

  return (
    <>
      <Table<WebhookConfiguration>
        actionRef={actionRef}
        disableStripedColoring={true}
        rowKey="action"
        headerTitle="Webhooks"
        search={false}
        columns={columns}
        pagination={false}
        request={request}
        toolBarRender={() => [
          <Button type="primary" onClick={handleCreateWebhook}>
            <PlusOutlined />
            Add endpoint
          </Button>,
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
