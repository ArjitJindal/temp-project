import React from 'react';
import { ExtendedSchema } from '../../types';
import SimplePropertyInput from './SimplePropertyInput';
import ArrayPropertyInput from './ArrayPropertyInput';
import DayWindowInput from './custom/DayWindowInput';
import TimeWindowInput from './custom/TimeWindowInput';
import AgeRangeInput from './custom/AgeRangeInput';
import CountriesInput from './custom/CountriesInput';
import ObjectPropertyInput from './ObjectPropertyInput';
import { getUiSchema } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';
import { InputProps } from '@/components/library/Form';
import TransactionAmountRangeInput from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/Property/PropertyInput/custom/TransactionAmountRangeInput';
import UserTypeInput from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/Property/PropertyInput/custom/UserTypeInput';
import CurrencyInput from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/Property/PropertyInput/custom/CurrencyInput';
import TransactionAmountThresholdsInput from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/Property/PropertyInput/custom/TransactionAmountThresholdsInput';

// todo: fix any
interface Props extends InputProps<any> {
  schema: ExtendedSchema;
}

export default function PropertyInput(props: Props) {
  const { schema } = props;

  const uiSchema = getUiSchema(schema);

  if (uiSchema['ui:subtype'] === 'DAY_WINDOW') {
    return <DayWindowInput {...props} />;
  }
  if (uiSchema['ui:subtype'] === 'TIME_WINDOW') {
    return <TimeWindowInput {...props} />;
  }
  if (uiSchema['ui:subtype'] === 'COUNTRIES') {
    return <CountriesInput {...props} />;
  }
  if (uiSchema['ui:subtype'] === 'AGE_RANGE') {
    return <AgeRangeInput {...props} />;
  }
  if (uiSchema['ui:subtype'] === 'TRANSACTION_AMOUNT_RANGE') {
    return <TransactionAmountRangeInput {...props} />;
  }
  if (uiSchema['ui:subtype'] === 'TRANSACTION_AMOUNT_THRESHOLDS') {
    return <TransactionAmountThresholdsInput {...props} />;
  }
  if (uiSchema['ui:subtype'] === 'USER_TYPE') {
    return <UserTypeInput {...props} />;
  }
  if (uiSchema['ui:subtype'] === 'CURRENCY') {
    return <CurrencyInput {...props} />;
  }

  switch (schema.type) {
    case 'number':
    case 'boolean':
    case 'integer':
    case 'string':
      return <SimplePropertyInput {...props} />;
    case 'object':
      return <ObjectPropertyInput {...props} />;
    case 'array':
      return <ArrayPropertyInput {...props} />;
  }

  console.error(`Schema type "${schema.type}" is not supported`);

  return <></>;
}
