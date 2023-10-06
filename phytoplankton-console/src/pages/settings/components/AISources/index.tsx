import { useState } from 'react';
import s from './index.module.less';
import { AIAttribute, AiSourcesResponse } from '@/apis';
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
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { COPILOT_AI_RESOURCES } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import SettingsCard from '@/components/library/SettingsCard';

export const AISources = () => {
  const settings = useSettings();
  const updateSettings = useUpdateTenantSettings();
  const [aiSourcesDisabled, setAiSourcesDisabled] = useState(settings.aiSourcesDisabled ?? []);
  const api = useApi();
  const AI_SOURCES = useQuery<AiSourcesResponse>(COPILOT_AI_RESOURCES(), async () => {
    return await api.getAiSources();
  });
  return (
    <AsyncResourceRenderer resource={AI_SOURCES.data}>
      {({ aiSources }) => {
        return (
          <SettingsCard
            title="AI Sources"
            description="Select the data sources to be used by the AI engine while generating narratives"
          >
            <>
              {AI_ATTRIBUTE_CATEGORYS.map((category) => (
                <div key={category} className={s.categoryDiv}>
                  <P bold className={s.paragraph}>
                    {humanizeAuto(category)}
                  </P>
                  {aiSources
                    .filter((source) => source.category === category)
                    .map(({ sourceName: key, isPii }) => (
                      <>
                        {isPii ? (
                          <Tooltip
                            title="We do not send this data to our AI engine as it may contain personally identifiable information (PII) we obfuscate this data before sending it to our AI engine."
                            placement="top"
                          >
                            <div className={s.checkboxDiv}>
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
                          <Label
                            key={key}
                            position="RIGHT"
                            label={humanizeCamelCase(key)}
                            level={2}
                          >
                            <Checkbox
                              key={key}
                              onChange={(value) => {
                                if (value) {
                                  setAiSourcesDisabled(
                                    aiSourcesDisabled.filter((source) => source !== key),
                                  );
                                } else {
                                  setAiSourcesDisabled([
                                    ...new Set(aiSourcesDisabled).add(key as AIAttribute),
                                  ]);
                                }
                              }}
                              value={
                                isPii ? false : !aiSourcesDisabled.includes(key as AIAttribute)
                              }
                              isDisabled={isPii}
                            />
                          </Label>
                        )}
                      </>
                    ))}
                </div>
              ))}
              <div className={s.buttonDiv}>
                <Button
                  onClick={() => {
                    updateSettings.mutate({
                      ...settings,
                      aiSourcesDisabled: aiSourcesDisabled,
                    });
                  }}
                >
                  Save
                </Button>
              </div>
            </>
          </SettingsCard>
        );
      }}
    </AsyncResourceRenderer>
  );
};
