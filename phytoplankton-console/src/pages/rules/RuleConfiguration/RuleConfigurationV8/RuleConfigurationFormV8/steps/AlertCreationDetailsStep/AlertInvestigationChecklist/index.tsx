import { useDebounce } from 'ahooks';
import { useMemo, useState } from 'react';
import { ChecklistTemplatesResponse } from '@/apis';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import { isLoading, isSuccess } from '@/utils/asyncResource';
import { useChecklistTemplates } from '@/hooks/api/checklists';

export const AlertInvestigationChecklist = <
  FormValues extends { checklistTemplateId?: string },
>(props: {
  label: string;
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const debouncedSearchTerm = useDebounce(searchTerm, { wait: 500 });

  const params = {
    filterName: debouncedSearchTerm,
  };

  const queryResult = useChecklistTemplates(params);

  const options = useMemo(() => {
    if (!isSuccess(queryResult.data)) {
      return [] as { label: string; value: string }[];
    }
    const res = queryResult.data.value as unknown as ChecklistTemplatesResponse;
    return res.data
      .filter((checklist) => checklist.status === 'ACTIVE')
      .map((checklist) => ({ label: checklist.name, value: checklist.id }));
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
