import { useState } from 'react';
import s from './styles.module.less';
import Label from '@/components/library/Label';
import SelectionGroup, {
  Option as SelectionGroupOption,
} from '@/components/library/SelectionGroup';
import SettingsCard from '@/components/library/SettingsCard';
import { WebhookRetryOnlyFor, WebhookSettings as WebhookSettingsType } from '@/apis';
import { useUpdateTenantSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';

const howLongToRetryForOptions: SelectionGroupOption<WebhookSettingsType['maxRetryHours']>[] = [
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
  { value: 72, label: '72 hours' },
];

const retryOnlyForOptions: SelectionGroupOption<WebhookRetryOnlyFor>[] = [
  { value: '3XX', label: '3XX' },
  { value: '4XX', label: '4XX' },
  { value: '5XX', label: '5XX' },
];

const backoffTypeOptions: SelectionGroupOption<WebhookSettingsType['retryBackoffStrategy']>[] = [
  {
    value: 'LINEAR',
    label: 'Linear',
    description:
      'Retry with a consistent 10-minute interval between each attempt. Each retry will wait the same fixed 10 minutes, providing a steady and predictable backoff strategy.',
  },
  {
    value: 'EXPONENTIAL',
    label: 'Exponential',
    description:
      'Implement a dynamic retry strategy with an exponential series of wait times: 10 minutes, 20 minutes, 40 minutes... up to a maximum of 360 minutes. Each subsequent retry extends the wait time, helping to prevent overwhelming temporary system issues.',
  },
];

const onFailureWebhookActionOptions: SelectionGroupOption<
  WebhookSettingsType['maxRetryReachedAction']
>[] = [
  { value: 'DISABLE_WEBHOOK', label: 'Disable webhook' },
  { value: 'IGNORE', label: 'Ignore failure' },
];

export const WebhookSettings: React.FC = () => {
  const [webhookSettings, setWebhookSettings] = useState<WebhookSettingsType>({
    maxRetryHours: 24,
    retryOnlyFor: ['4XX'],
    retryBackoffStrategy: 'LINEAR',
    maxRetryReachedAction: 'DISABLE_WEBHOOK',
  });

  const settingsMutation = useUpdateTenantSettings();

  return (
    <SettingsCard title="Webhook settings">
      <div className={s.webhookSettings}>
        <Label
          label="How long to retry for"
          description="How long to retry failed webhook requests"
        >
          <SelectionGroup<number>
            options={howLongToRetryForOptions}
            value={webhookSettings.maxRetryHours}
            onChange={(value) => {
              if (value != null) {
                setWebhookSettings({ ...webhookSettings, maxRetryHours: value });
              }
            }}
            mode="SINGLE"
          />
        </Label>
        <Label label="Retry only for" description="Retry only for specific status codes">
          <SelectionGroup<WebhookRetryOnlyFor>
            options={retryOnlyForOptions}
            value={webhookSettings.retryOnlyFor}
            onChange={(value) => {
              if (value != null) {
                setWebhookSettings({ ...webhookSettings, retryOnlyFor: value });
              }
            }}
            mode="MULTIPLE"
          />
        </Label>
        <Label label="Backoff type" description="Backoff type">
          <SelectionGroup<WebhookSettingsType['retryBackoffStrategy']>
            options={backoffTypeOptions}
            value={webhookSettings.retryBackoffStrategy}
            onChange={(value) => {
              if (value != null) {
                setWebhookSettings({ ...webhookSettings, retryBackoffStrategy: value });
              }
            }}
            mode="SINGLE"
          />
        </Label>
        <Label label="On failure webhook action" description="On failure webhook action">
          <SelectionGroup<WebhookSettingsType['maxRetryReachedAction']>
            options={onFailureWebhookActionOptions}
            value={webhookSettings.maxRetryReachedAction}
            onChange={(value) => {
              if (value != null) {
                setWebhookSettings({ ...webhookSettings, maxRetryReachedAction: value });
              }
            }}
            mode="SINGLE"
          />
        </Label>
        <Button
          className={s.saveButton}
          onClick={() => settingsMutation.mutate({ webhookSettings })}
        >
          Save
        </Button>
      </div>
    </SettingsCard>
  );
};
