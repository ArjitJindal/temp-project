import React from 'react';
import { UiSchemaCountries } from '../../../../types';
import { InputProps } from '@/components/library/Form';
import COUNTRIES, { CountryCode } from '@/utils/countries';
import Select, { Option } from '@/components/library/Select';

const OPTIONS = Object.entries(COUNTRIES).map(
  (entry): Option<CountryCode> => ({
    value: entry[0] as CountryCode,
    label: entry[1],
  }),
);

interface Props extends InputProps<CountryCode[]> {
  uiSchema: UiSchemaCountries;
}

export default function CountriesInput(props: Props) {
  return (
    <Select<CountryCode>
      mode={'MULTIPLE'}
      options={OPTIONS}
      placeholder="Select countries"
      {...props}
    />
  );
}
