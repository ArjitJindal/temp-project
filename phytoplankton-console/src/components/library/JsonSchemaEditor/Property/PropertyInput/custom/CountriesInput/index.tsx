import React from 'react';
import { COUNTRIES, CountryCode } from '@flagright/lib/constants';
import { UiSchemaCountries, UiSchemaCountry } from '../../../../types';
import { InputProps } from '@/components/library/Form';
import Select, { Option } from '@/components/library/Select';

const OPTIONS = Object.entries(COUNTRIES).map(
  (entry): Option<CountryCode> => ({
    value: entry[0] as CountryCode,
    label: entry[1],
  }),
);

interface Props extends InputProps<any> {
  uiSchema: UiSchemaCountries | UiSchemaCountry;
}

export default function CountriesInput(props: Props) {
  const mode = props.uiSchema['ui:subtype'] === 'COUNTRIES' ? 'MULTIPLE' : 'SINGLE';
  return (
    <Select<CountryCode>
      mode={mode}
      options={OPTIONS}
      portaled
      placeholder={`Select ${mode === 'MULTIPLE' ? 'countries' : 'country'}`}
      {...props}
    />
  );
}
