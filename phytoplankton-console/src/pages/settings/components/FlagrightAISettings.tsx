import { Switch } from 'antd';
import Confirm from '@/components/utils/Confirm/index';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { isWhiteLabeled } from '@/utils/branding';

const whiteLabeled = isWhiteLabeled();

export const FlagrightAISettings = () => {
  const settings = useSettings();

  const mutateTenantSettings = useUpdateTenantSettings();
  const handleDisable = () => {
    mutateTenantSettings.mutate({ isAiEnabled: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ isAiEnabled: true });
  };

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
            checked={settings.isAiEnabled}
            onChange={!settings.isAiEnabled ? onClick : handleDisable}
            loading={mutateTenantSettings.isLoading}
          />
        )}
      </Confirm>
    </div>
  );
};
