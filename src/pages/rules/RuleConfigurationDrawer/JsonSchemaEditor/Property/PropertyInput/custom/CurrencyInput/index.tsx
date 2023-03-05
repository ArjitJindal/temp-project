import React from 'react';
import { InputProps } from '@/components/library/Form';
import Select from '@/components/library/Select';
import { CURRENCIES_SELECT_OPTIONS, Currency } from '@/utils/currencies';

interface Props extends InputProps<Currency> {}

export default function CurrencyInput(props: Props) {
  const { ...rest } = props;
  return (
    <Select
      options={CURRENCIES_SELECT_OPTIONS}
      placeholder="Select currency"
      showSearch={true}
      {...rest}
    />
  );
}
