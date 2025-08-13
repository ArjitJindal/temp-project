import React from 'react';
import { MAX_SLA_POLICIES_PER_ENTITY } from '@flagright/lib/constants';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import { slaPoliciesOptions, useSlas } from '@/utils/sla';
import { getOr, isLoading } from '@/utils/asyncResource';
function SlaPolicyInput<FormValues extends { slaPolicies?: string[] }>() {
  const slaPoliciesData = useSlas();
  const options = slaPoliciesOptions(getOr(slaPoliciesData, []), 'name');
  return (
    <InputField<FormValues, 'slaPolicies'>
      name={'slaPolicies'}
      label={'SLA policies'}
      labelProps={{ required: { value: false, showHint: true } }}
      description={`A maximum of ‘${MAX_SLA_POLICIES_PER_ENTITY}’ SLA policies can be selected per rule to apply.`}
    >
      {(inputProps) => {
        return (
          <Select<string>
            placeholder="Select from pre defined SLA policy"
            mode="TAGS"
            options={options}
            isLoading={isLoading(slaPoliciesData)}
            {...inputProps}
            onChange={(value) => {
              const limitedValue = value?.slice(0, MAX_SLA_POLICIES_PER_ENTITY);
              inputProps.onChange?.(limitedValue);
            }}
          />
        );
      }}
    </InputField>
  );
}

export default SlaPolicyInput;
