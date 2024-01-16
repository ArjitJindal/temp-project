import React from 'react';
import { CURRENCIES_SELECT_OPTIONS, Currency } from '@flagright/lib/constants';
import { InputProps } from '@/components/library/Form';
import Select from '@/components/library/Select';
import { UiSchemaCurrency } from '@/components/library/JsonSchemaEditor/types';

interface Props extends InputProps<Currency> {
  uiSchema?: UiSchemaCurrency;
}

export default function CurrencyInput(props: Props) {
  const { ...rest } = props;
  return <Select options={CURRENCIES_SELECT_OPTIONS} placeholder="Select currency" {...rest} />;
}
