import React from 'react';
import InputField from '@/components/library/Form/InputField';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { SLAPolicy } from '@/apis/models/SLAPolicy';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { SLA_POLICY_LIST } from '@/utils/queries/keys';
import { getOr } from '@/utils/asyncResource';
import Select from '@/components/library/Select';

function SlaPolicyInput<FormValues extends { slaPolicies?: string[] }>() {
  const api = useApi();
  const slaPoliciesResult = usePaginatedQuery<SLAPolicy>(
    SLA_POLICY_LIST(DEFAULT_PARAMS_STATE),
    async (paginationParams) => {
      return await api.getSlaPolicies({
        ...DEFAULT_PARAMS_STATE,
        ...paginationParams,
      });
    },
  );
  const options = getOr(slaPoliciesResult.data, { total: 0, items: [] }).items.map((slaPolicy) => ({
    label: slaPolicy.id,
    value: slaPolicy.id,
  }));
  return (
    <InputField<FormValues, 'slaPolicies'>
      name={'slaPolicies'}
      label={'SLA policies'}
      labelProps={{ required: { value: false, showHint: true } }}
      description="A maximum of ‘3’ SLA policies can be selected per rule to apply."
    >
      {(inputProps) => {
        return (
          <Select<string>
            placeholder="Select from pre defined SLA policy"
            mode="MULTIPLE"
            options={options}
            {...inputProps}
            onChange={(value) => {
              if ((value?.length ?? 0) > 3) {
                inputProps.onChange?.(value?.slice(0, 3));
              }
              inputProps.onChange?.(value);
            }}
          />
        );
      }}
    </InputField>
  );
}

export default SlaPolicyInput;
