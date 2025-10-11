import AsyncResourceRenderer from '../utils/AsyncResourceRenderer';
import Select from '../library/Select';
import { useNarrativeTemplates } from '@/hooks/api';

type Props = {
  mode?: 'DEFAULT' | 'TEXT';
  templateValue: string | undefined | null;
  setTemplateValue: (value: string | undefined) => void;
};

const NarrativeTemplateSelect = (props: Props) => {
  const { mode = 'DEFAULT', templateValue, setTemplateValue } = props;
  const narrativeQueryResponse = useNarrativeTemplates();

  return (
    <AsyncResourceRenderer resource={narrativeQueryResponse.data} renderLoading={() => null}>
      {(narrativeTemplates) => {
        const narrativeTemplatesOptions = narrativeTemplates.items.map((narrativeTemplate) => ({
          label: narrativeTemplate.name,
          value: narrativeTemplate.id,
        }));

        return (
          <div style={{ width: 180 }}>
            <Select
              hideBorders={mode === 'TEXT'}
              placeholder="Narrative templates"
              options={narrativeTemplatesOptions}
              value={templateValue}
              onChange={(value) => {
                const narrativeTemplate = narrativeTemplates.items.find(
                  (narrativeTemplate) => narrativeTemplate.id === value,
                );

                if (narrativeTemplate) {
                  setTemplateValue(narrativeTemplate.description);
                }
              }}
            />
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
};

export default NarrativeTemplateSelect;
