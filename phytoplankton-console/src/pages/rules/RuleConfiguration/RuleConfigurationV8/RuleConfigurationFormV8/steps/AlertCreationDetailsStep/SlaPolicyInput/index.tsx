import React from 'react';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import { slaPoliciesOptions, useSlas } from '@/utils/sla';
import { getOr, isLoading } from '@/utils/asyncResource';

function SlaPolicyInput<FormValues extends { slaPolicies?: string[] }>() {
  const slaPoliciesData = useSlas();
  const options = slaPoliciesOptions(getOr(slaPoliciesData, []), 'id');
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
            isLoading={isLoading(slaPoliciesData)}
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
