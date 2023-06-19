import { useState } from 'react';
import { Switch } from 'antd';
import { useMutation } from '@tanstack/react-query';
import Confirm from '@/components/utils/Confirm/index';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { isWhiteLabeled } from '@/utils/branding';

const whiteLabeled = isWhiteLabeled();

export const FlagrightAISettings = () => {
  const settings = useSettings();
  const [value, setValue] = useState<boolean>(settings?.isAiEnabled ?? false);

  const api = useApi();

  const handleDisable = () => {
    handleFinishMutation.mutate({ value: false });
  };

  const handleEnable = () => {
    handleFinishMutation.mutate({ value: true });
  };

  const handleFinishMutation = useMutation<unknown, unknown, { value: boolean }>(
    async (event) => {
      const { value } = event;
      await api.postTenantsSettings({
        TenantSettings: {
          isAiEnabled: value,
        },
      });
    },
    {
      retry: false,
      onSuccess: (data, variables) => {
        const { value } = variables;
        setValue(value);
        message.success(`AI Features ${value ? 'enabled' : 'disabled'} successfully.`);
      },
      onError: () => {
        message.fatal(`Unable to update settings!`);
      },
    },
  );
  const statement =
    'We partner with OpenAI as a subcontractor to provide you with certain features and operational capabilities including GPT. OpenAI does not store any data. Using AI Features is compliant with data privacy and protection laws.';
  const displayText = <p>{statement}</p>;
  return (
    <div>
      <h3>{whiteLabeled ? '' : 'Flagright'} AI Features</h3>
      <p>Supercharge your productivity with AI Features including GPT.</p>
      <br />

      <Confirm title="Are you sure?" text={displayText} onConfirm={handleEnable}>
        {({ onClick }) => (
          <Switch
            checked={value}
            onChange={!value ? onClick : handleDisable}
            loading={handleFinishMutation.isLoading}
          />
        )}
      </Confirm>
    </div>
  );
};
