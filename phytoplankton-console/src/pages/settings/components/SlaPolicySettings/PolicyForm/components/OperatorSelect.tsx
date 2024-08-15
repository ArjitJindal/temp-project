import React from 'react';
import { NumberOperators } from '@/apis';
import Select, { Option } from '@/components/library/Select';

interface Props<T extends NumberOperators | string> {
  value: T | undefined;
  onChange?: (value: T | undefined) => void;
  options: Option<T>[];
  isDisabled?: boolean;
}

function OperatorSelect<T extends NumberOperators | string>(props: Props<T>) {
  return (
    <Select<T>
      isDisabled={props.isDisabled}
      options={props.options}
      value={props.value}
      mode="SINGLE"
      onChange={props.onChange}
    />
  );
}

export default OperatorSelect;
