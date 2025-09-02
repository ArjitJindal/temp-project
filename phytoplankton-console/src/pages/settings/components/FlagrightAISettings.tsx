import { humanizeConstant } from '@flagright/lib/utils/humanize';
import SettingsCard from '@/components/library/SettingsCard';
import Confirm from '@/components/utils/Confirm/index';
import {
  useFeatureEnabled,
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { isWhiteLabeled } from '@/utils/branding';
import Toggle from '@/components/library/Toggle';
import Tooltip from '@/components/library/Tooltip';
import { useHasResources } from '@/utils/user-utils';
import SelectionGroup from '@/components/library/SelectionGroup';
import { LLM_PROVIDERS } from '@/apis/models-custom/LLMProvider';

const whiteLabeled = isWhiteLabeled();

export const FlagrightAISettings = () => {
  const permissions = useHasResources(['write:::settings/add-ons/ai-features/*']);
  const settings = useSettings();
  const isNarrativeCopilotEnabled = useFeatureEnabled('NARRATIVE_COPILOT');
  const isAiForensicsEnabled = useFeatureEnabled('AI_FORENSICS');
  const isAiEnabled = settings.isAiEnabled;
  const mutateTenantSettings = useUpdateTenantSettings();
  const llmProvider = settings.llmProvider ?? 'ANTHROPIC';
  const handleDisable = () => {
    mutateTenantSettings.mutate({ isAiEnabled: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ isAiEnabled: true });
  };

  const statement =
    'We partner with Anthropic and OpenAI as subcontractors to provide certain features and operational capabilities. Neither Anthropic nor OpenAI stores any data. The use of AI features is fully compliant with data privacy and protection laws.';

  const displayText = <p>{statement}</p>;
  return (
    <div>
      <SettingsCard
        title={whiteLabeled ? 'AI Features' : 'Flagright AI features'}
        description={`Supercharge team productivity with advanced AI features including AI Forensics.`}
        minRequiredResources={['write:::settings/add-ons/ai-features/*']}
      >
        {isNarrativeCopilotEnabled || isAiForensicsEnabled ? (
          <Confirm title="Are you sure?" text={displayText} onConfirm={handleEnable}>
            {({ onClick }) => (
              <Toggle
                value={settings.isAiEnabled}
                onChange={!settings.isAiEnabled ? onClick : handleDisable}
                isLoading={mutateTenantSettings.isLoading}
                isDisabled={!permissions}
              />
            )}
          </Confirm>
        ) : (
          <Tooltip title={`Contact us to purchase AI features.`} placement="topLeft">
            <div>
              <Toggle value={false} isDisabled={true} />
            </div>
          </Tooltip>
        )}
      </SettingsCard>
      {isAiEnabled && (
        <SettingsCard
          title="LLM Provider"
          description="Select the LLM provider you want to use for AI Features."
          minRequiredResources={['write:::settings/add-ons/ai-features/*']}
        >
          <SelectionGroup
            mode="SINGLE"
            options={LLM_PROVIDERS.map((provider) => ({
              label: humanizeConstant(provider),
              value: provider,
            }))}
            value={llmProvider}
            onChange={(value) => mutateTenantSettings.mutate({ llmProvider: value })}
            isDisabled={!permissions}
          />
        </SettingsCard>
      )}
    </div>
  );
};
