import { useCallback, useState } from 'react';
import { Divider } from 'antd';
import ProDescriptions from '@ant-design/pro-descriptions';
import { LoadingOutlined } from '@ant-design/icons';
import { WebhookConfiguration, WebhookSecrets } from '@/apis';
import { InputProps } from '@/components/library/Form';
import { ExtendedSchema } from '@/components/library/JsonSchemaEditor/types';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import { WebhookDeliveryAttemptsTable } from '@/pages/settings/components/WebhookDeliveryAttemptsTable';

export interface Props extends InputProps<WebhookConfiguration['_id']> {
  uiSchema?: ExtendedSchema;
}

export const WebhookInput = (props: Props) => {
  const api = useApi();
  const { value } = props;
  const [secrets, setSecrets] = useState<WebhookSecrets>();
  const [loadingSecret, setLoadingSecret] = useState(false);
  const handleRevealSecret = useCallback(async () => {
    try {
      setLoadingSecret(true);
      const secrets = await api.getWebhooksWebhookIdSecret({ webhookId: value as string });
      setSecrets(secrets);
    } catch (e) {
      message.fatal(`Failed to fetch secret`, e);
    } finally {
      setLoadingSecret(false);
    }
  }, [api, value]);
  return (
    <>
      <ProDescriptions column={1}>
        {value && (
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
      {value && (
        <>
          <Divider orientation="left" orientationMargin="0">
            Webhook attempts
          </Divider>
          <WebhookDeliveryAttemptsTable webhookId={value} />
        </>
      )}
    </>
  );
};
