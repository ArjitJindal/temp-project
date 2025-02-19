import { useState } from 'react';
import s from './styles.module.less';
import Label from '@/components/library/Label';
import SelectionGroup, {
  Option as SelectionGroupOption,
} from '@/components/library/SelectionGroup';
import SettingsCard from '@/components/library/SettingsCard';
import { WebhookRetryOnlyFor, WebhookSettings as WebhookSettingsType } from '@/apis';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
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
      'Retry at a consistent 10-minute interval, ensuring predictable timing and steady retry attempts.',
  },
  {
    value: 'EXPONENTIAL',
    label: 'Exponential',
    description:
      'Retry with increasing wait times (10, 20, 40 minutes) up to 360 minutes, reducing load on systems experiencing temporary issues.',
  },
];

const onFailureWebhookActionOptions: SelectionGroupOption<
  WebhookSettingsType['maxRetryReachedAction']
>[] = [
  { value: 'DISABLE_WEBHOOK', label: 'Yes' },
  { value: 'IGNORE', label: 'No' },
];

export const WebhookSettings: React.FC = () => {
  const settings = useSettings();

  const [webhookSettings, setWebhookSettings] = useState<WebhookSettingsType>({
    maxRetryHours: 24,
    retryOnlyFor: ['3XX', '4XX', '5XX'],
    retryBackoffStrategy: 'LINEAR',
    maxRetryReachedAction: 'DISABLE_WEBHOOK',
    ...settings.webhookSettings,
  });

  const settingsMutation = useUpdateTenantSettings();

  return (
    <SettingsCard title="Webhook settings">
      <div className={s.webhookSettings}>
        <Label
          label="Retry duration"
          description="Set the duration for retrying failed webhook requests"
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
        <Label
          label="Retry conditions"
          description="Select the HTTP status codes that trigger retries"
        >
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
        <Label label="Backoff type">
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
        <Label
          label="Webhook disabling"
          description="Automatically disable the webhook after repeated failures to prevent continued errors."
        >
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
