import { useState } from 'react';
import SettingsCard from './SettingsCard';
import { AIAttribute, AIAttributeCategory } from '@/apis';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { AI_ATTRIBUTE_CATEGORYS } from '@/apis/models-custom/AIAttributeCategory';
import { P } from '@/components/ui/Typography';
import Checkbox from '@/components/library/Checkbox';
import Label from '@/components/library/Label';
import { humanizeAuto, humanizeCamelCase } from '@/utils/humanize';
import Button from '@/components/library/Button';
import Tooltip from '@/components/library/Tooltip';

const AI_SOURCES_MAP: { [key in AIAttribute]: AIAttributeCategory } = {
  averageTransactionAmount: 'TRANSACTION',
  caseComments: 'CASE',
  caseGenerationDate: 'CASE',
  closureDate: 'CASE',
  name: 'USER',
  country: 'TRANSACTION',
  firstPaymentAmount: 'TRANSACTION',
  industry: 'USER',
  maxAmount: 'TRANSACTION',
  minAmount: 'TRANSACTION',
  productsSold: 'USER',
  ruleHitNames: 'CASE',
  ruleHitNature: 'CASE',
  totalTransactionAmount: 'TRANSACTION',
  transactionIds: 'TRANSACTION',
  transactionsCount: 'TRANSACTION',
  userComments: 'USER',
  userType: 'USER',
  websites: 'USER',
};

const DEFAULT_PII_FIELDS: AIAttribute[] = ['name'];

export const AISources = () => {
  const settings = useSettings();
  const updateSettings = useUpdateTenantSettings();
  const [aiSources, setAISources] = useState(settings?.aiFieldsEnabled || []);

  return (
    <SettingsCard
      title="AI Sources"
      description="Select the data sources to be used by the AI engine while generating narratives"
    >
      <>
        {AI_ATTRIBUTE_CATEGORYS.map((category) => (
          <div key={category}>
            <P bold style={{ marginBottom: '0.25rem', marginTop: '0.5rem' }}>
              {humanizeAuto(category)}
            </P>
            {Object.entries(AI_SOURCES_MAP)
              .filter(([_, value]) => value === category)
              .map(([key, _]) => (
                <>
                  {DEFAULT_PII_FIELDS.includes(key as AIAttribute) ? (
                    <Tooltip
                      title="We do not send this data to our AI engine as it may contain personally identifiable information (PII) we obfuscate this data before sending it to our AI engine."
                      placement="top"
                    >
                      <div style={{ width: 'fit-content' }}>
                        <Label
                          key={key}
                          position="RIGHT"
                          label={`${humanizeCamelCase(key)} ⓘ`}
                          level={2}
                        >
                          <Checkbox key={key} value={false} isDisabled />
                        </Label>
                      </div>
                    </Tooltip>
                  ) : (
                    <Label key={key} position="RIGHT" label={humanizeCamelCase(key)} level={2}>
                      <Checkbox
                        key={key}
                        onChange={(value) => {
                          if (value) {
                            setAISources([...new Set(aiSources).add(key as AIAttribute)]);
                          } else {
                            setAISources(aiSources.filter((source) => source !== key));
                          }
                        }}
                        value={
                          DEFAULT_PII_FIELDS.includes(key as AIAttribute)
                            ? false
                            : aiSources.includes(key as AIAttribute)
                        }
                        isDisabled={DEFAULT_PII_FIELDS.includes(key as AIAttribute)}
                      />
                    </Label>
                  )}
                </>
              ))}
          </div>
        ))}
        <div style={{ marginTop: '1rem' }}>
          <Button
            onClick={() => {
              updateSettings.mutate({
                ...settings,
                aiFieldsEnabled: aiSources,
              });
            }}
          >
            Save
          </Button>
        </div>
      </>
    </SettingsCard>
  );
};
