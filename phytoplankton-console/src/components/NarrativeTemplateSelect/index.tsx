import AsyncResourceRenderer from '../utils/AsyncResourceRenderer';
import Select from '../library/Select';
import s from './index.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { NARRATIVE_TEMPLATE_LIST } from '@/utils/queries/keys';

const NARRATIVE_PAGE = 1;
const NARRATIVE_PAGE_SIZE = 1000;

type Props = {
  mode?: 'DEFAULT' | 'TEXT';
  templateValue: string | undefined | null;
  setTemplateValue: (value: string | undefined) => void;
};

const NarrativeTemplateSelect = (props: Props) => {
  const api = useApi();
  const { mode = 'DEFAULT', templateValue, setTemplateValue } = props;
  const narrativeQueryResponse = useQuery(
    NARRATIVE_TEMPLATE_LIST({ page: NARRATIVE_PAGE, pageSize: NARRATIVE_PAGE_SIZE }),
    async () => {
      return await api.getNarratives({ page: NARRATIVE_PAGE, pageSize: NARRATIVE_PAGE_SIZE });
    },
  );

  return (
    <AsyncResourceRenderer resource={narrativeQueryResponse.data} renderLoading={() => null}>
      {(narrativeTemplates) => {
        const narrativeTemplatesOptions = narrativeTemplates.items.map((narrativeTemplate) => ({
          label: narrativeTemplate.name,
          value: narrativeTemplate.id,
        }));

        return (
          <Select
            className={s[`mode-${mode}`]}
            placeholder="Narrative templates"
            options={narrativeTemplatesOptions}
            style={{ width: 180 }}
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
        );
      }}
    </AsyncResourceRenderer>
  );
};

export default NarrativeTemplateSelect;
