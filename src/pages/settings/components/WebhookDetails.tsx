import ProDescriptions from '@ant-design/pro-descriptions';
import { Divider, Input, message, Row, Select, Space } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import equal from 'fast-deep-equal';
import { DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import { WebhookDeliveryAttemptsTable } from './WebhookDeliveryAttemptsTable';
import { WebhookConfiguration, WebhookEventType, WebhookSecrets } from '@/apis';
import Button from '@/components/ui/Button';
import { useApi } from '@/api';

const WEBHOOK_EVENTS: WebhookEventType[] = ['USER_STATE_UPDATED'];

interface Props {
  webhook: WebhookConfiguration;
  handleSaveWebhook: (webhook: WebhookConfiguration) => Promise<void>;
  handleDeleteWebhook: (webhook: WebhookConfiguration) => Promise<void>;
}

function isValidWebhookUrl(webhookUrl: string): boolean {
  try {
    const url = new URL(webhookUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

export const WebhookDetails: React.FC<Props> = ({
  webhook,
  handleSaveWebhook,
  handleDeleteWebhook,
}) => {
  const api = useApi();
  const [webhookUrl, setWebhookUrl] = useState(webhook.webhookUrl);
  const [events, setEvents] = useState(webhook.events);
  const [secrets, serSecrets] = useState<WebhookSecrets>();
  const [loadingSecret, setLoadingSecret] = useState(false);
  const canSave = useMemo(() => {
    return (
      events.length > 0 &&
      isValidWebhookUrl(webhookUrl) &&
      (webhookUrl !== webhook.webhookUrl || !equal(events, webhook.events))
    );
  }, [events, webhook.events, webhook.webhookUrl, webhookUrl]);
  const handleRevealSecret = useCallback(async () => {
    try {
      setLoadingSecret(true);
      const secrets = await api.getWebhooksWebhookIdSecret({ webhookId: webhook._id as string });
      serSecrets(secrets);
    } catch (e) {
      message.error(`Failed to fetch secret`);
    } finally {
      setLoadingSecret(false);
    }
  }, [api, webhook._id]);
  return (
    <>
      <Row justify="end" style={{ paddingBottom: 10 }}>
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => handleSaveWebhook({ ...webhook, webhookUrl, events })}
            disabled={!canSave}
          >
            Save
          </Button>
          {webhook._id && (
            <Button
              analyticsName="Delete"
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteWebhook(webhook)}
              size="small"
              danger
            >
              Delete
            </Button>
          )}
        </Space>
      </Row>
      <ProDescriptions column={1}>
        <ProDescriptions.Item label="Endpoint URL" valueType="text">
          <Input
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value.trim())}
          />
        </ProDescriptions.Item>
        <ProDescriptions.Item label="Events">
          <Select<WebhookEventType[]>
            mode="multiple"
            style={{ width: '100%' }}
            options={WEBHOOK_EVENTS.map((event) => ({ label: event, value: event }))}
            onChange={(events) => setEvents(events)}
            allowClear
            value={events}
          />
        </ProDescriptions.Item>
        {webhook._id && (
          <ProDescriptions.Item label="Signing secret">
            {secrets ? (
              <>
                <div>{secrets.secret}</div>
                {secrets.expiringSecret && <div>{`${secrets.expiringSecret} (expiring)`}</div>}
              </>
            ) : loadingSecret ? (
              <LoadingOutlined />
            ) : (
              <a onClick={handleRevealSecret}>Reveal</a>
            )}
          </ProDescriptions.Item>
        )}
      </ProDescriptions>
      {webhook._id && (
        <>
          <Divider orientation="left" orientationMargin="0">
            Webhook attempts
          </Divider>
          <WebhookDeliveryAttemptsTable webhookId={webhook._id} />
        </>
      )}
    </>
  );
};
