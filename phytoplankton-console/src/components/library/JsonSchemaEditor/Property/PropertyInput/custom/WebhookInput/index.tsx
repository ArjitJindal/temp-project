import { useCallback, useState } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import style from './index.module.less';
import { WebhookConfiguration, WebhookSecrets } from '@/apis';
import { InputProps } from '@/components/library/Form';
import { UiSchemaWebhook } from '@/components/library/JsonSchemaEditor/types';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import { WebhookDeliveryAttemptsTable } from '@/pages/settings/components/WebhookDeliveryAttemptsTable';
import Label from '@/components/library/Label';
import { H4 } from '@/components/ui/Typography';

export interface Props extends InputProps<WebhookConfiguration['_id']> {
  uiSchema?: UiSchemaWebhook;
}

export const WebhookInput = (props: Props) => {
  const api = useApi();
  const { value } = props;
  const [secrets, setSecrets] = useState<WebhookSecrets>();
  const [loadingSecret, setLoadingSecret] = useState(false);
  const handleRevealSecret = useCallback(async () => {
    try {
      setLoadingSecret(true);
      if (value == null) {
        message.fatal(`Webhook ID is not set`);
        return;
      }
      const secrets = await api.getWebhooksWebhookIdSecret({ webhookId: value });
      setSecrets(secrets);
    } catch (e) {
      message.fatal(`Failed to fetch secret`, e);
    } finally {
      setLoadingSecret(false);
    }
  }, [api, value]);
  return (
    <>
      {value && (
        <Label level={2} label={'Signing secret'}>
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
        </Label>
      )}
      {value && (
        <>
          <div className={style.webhookSection}>
            <H4>Webhook attempts</H4>
          </div>
          <WebhookDeliveryAttemptsTable webhookId={value} />
        </>
      )}
    </>
  );
};
