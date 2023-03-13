import React from 'react';
import { InputProps } from '@/components/library/Form';
import Select from '@/components/library/Select';
import { CURRENCIES_SELECT_OPTIONS, Currency } from '@/utils/currencies';
import { UiSchemaCurrency } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/types';

interface Props extends InputProps<Currency> {
  uiSchema?: UiSchemaCurrency;
}

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
