import { useDebounce } from 'ahooks';
import { useMemo, useState } from 'react';
import { useApi } from '@/api';
import { ChecklistTemplatesResponse } from '@/apis';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import { isLoading, isSuccess } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { CHECKLIST_TEMPLATES } from '@/utils/queries/keys';

export const AlertInvestigationChecklist = <
  FormValues extends { checklistTemplateId?: string },
>(props: {
  label: string;
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const api = useApi();
  const debouncedSearchTerm = useDebounce(searchTerm, { wait: 500 });

  const params = {
    filterName: debouncedSearchTerm,
  };

  const queryResult = useQuery<ChecklistTemplatesResponse>(CHECKLIST_TEMPLATES(params), async () =>
    api.getChecklistTemplates(params),
  );

  const options = useMemo(() => {
    return isSuccess(queryResult.data)
      ? queryResult.data.value.data
          .filter((checklist) => checklist.status === 'ACTIVE')
          .map((checklist) => ({
            label: checklist.name,
            value: checklist.id,
          }))
      : [];
  }, [queryResult.data]);

  return (
    <InputField<FormValues, 'checklistTemplateId'>
      name="checklistTemplateId"
      label={props.label}
      data-cy="checklist-template-dropdown"
      description="Pre-defined checklist templates for alert investigation."
    >
      {(inputProps) => (
        <Select
          {...inputProps}
          value={options.length ? inputProps.value : undefined}
          options={options}
          mode="SINGLE"
          placeholder="Select investigation checklist template"
          onSearch={setSearchTerm}
          isLoading={isLoading(queryResult.data)}
          isDisabled={isLoading(queryResult.data)}
        />
      )}
    </InputField>
  );
};
