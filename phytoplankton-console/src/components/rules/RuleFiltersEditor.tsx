import { AjvError, IChangeEvent } from '@rjsf/core';
import { Fragment, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingOutlined } from '@ant-design/icons';
import { JsonSchemaForm } from '@/components/JsonSchemaForm';
import { RULE_FILTERS } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { getFixedSchemaJsonForm, removeNil } from '@/utils/json';

interface Props {
  filters: object;
  onChange: (newFilters: object, errors: AjvError[]) => void;
  readonly?: boolean;
}

export const RuleFiltersEditor: React.FC<Props> = ({ filters, onChange, readonly }) => {
  const api = useApi();
  const queryResults = useQuery(RULE_FILTERS(), () => api.getRuleFilters());
  const handleChange = useCallback(
    (event: IChangeEvent) => {
      if (onChange) {
        onChange(removeNil(event.formData), event.errors);
      }
    },
    [onChange],
  );

  useEffect(() => {
    if (queryResults.data?.defaultValues) {
      onChange(queryResults.data.defaultValues, []);
    }
  }, [queryResults.data, onChange]);

  return queryResults.isLoading ? (
    <LoadingOutlined />
  ) : (
    <div>
      <JsonSchemaForm
        schema={getFixedSchemaJsonForm(queryResults.data?.schema ?? {})}
        formData={filters}
        onChange={handleChange}
        readonly={readonly}
        liveValidate
      >
        {/* Add a dummy fragment for disabling the submit button */}
        <Fragment />
      </JsonSchemaForm>
    </div>
  );
};
