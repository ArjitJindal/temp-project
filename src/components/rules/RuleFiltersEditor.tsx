import { AjvError, IChangeEvent } from '@rjsf/core';
import { Fragment, useCallback } from 'react';
import _ from 'lodash';
import { useQuery } from '@tanstack/react-query';
import { LoadingOutlined } from '@ant-design/icons';
import { JsonSchemaForm } from '@/components/JsonSchemaForm';
import { RULE_FILTERS } from '@/utils/queries/keys';
import { useApi } from '@/api';

function getFixedSchema(schema: object) {
  return _.cloneDeepWith(schema, (value) => {
    /**
     * antd theme doesn't allow clearing the selected enum even the field is nullable.
     * In this case, we concat the "empty" option and it'll be removed by removeNil
     * to be a truly nullable field
     */
    if (value?.enum && value?.type === 'string' && value?.nullable) {
      return {
        ...value,
        enum: [''].concat(value.enum),
      };
    }
  });
}

function removeNil(formData: object) {
  return JSON.parse(
    JSON.stringify(formData, (k, v) => {
      if (v === null) {
        return undefined;
      }
      return v;
    }),
  );
}

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

  return queryResults.isLoading ? (
    <LoadingOutlined />
  ) : (
    <div>
      <JsonSchemaForm
        schema={getFixedSchema(queryResults.data)}
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
