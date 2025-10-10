import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { COUNTRY_REGIONS, COUNTRIES, isCountryCode, CountryCode } from '@flagright/lib/constants';
import { UiSchemaCountryRegion } from '../../../../types';
import { InputProps } from '@/components/library/Form';
import Select, { Option } from '@/components/library/Select';
import { useFormState } from '@/components/library/Form/utils/hooks';
import { useIsChanged } from '@/utils/hooks';

const ALL_OPTIONS = Object.entries(COUNTRY_REGIONS).flatMap(([countryCode, regions]) =>
  Object.entries(regions).map(
    ([regionCode, regionName]): Option<string> => ({
      value: regionCode,
      label: `${COUNTRIES[countryCode]} / ${regionName} (${regionCode})`,
    }),
  ),
);

interface Props extends InputProps<string> {
  uiSchema?: UiSchemaCountryRegion;
}

export default function CountryRegion(props: Props) {
  const { value, onChange, ...rest } = props;

  const formState = useFormState<{ [key: string]: unknown }>();
  const countryField = props.uiSchema?.['ui:countryField'];
  const countryCode: CountryCode | null = useMemo(() => {
    if (countryField == null) {
      return null;
    }
    const countryFieldValue = formState.values[countryField];
    return isCountryCode(countryFieldValue) ? countryFieldValue : null;
  }, [formState.values, countryField]);

  const [previousChoices, setPreviousChoices] = useState({
    [countryCode ?? '']: props.value,
  });

  const options = useMemo(() => {
    if (isCountryCode(countryCode) && COUNTRY_REGIONS[countryCode]) {
      return Object.entries(COUNTRY_REGIONS[countryCode]).map(
        ([regionCode, regionName]): Option<string> => ({
          value: regionCode,
          label: `${regionName} (${regionCode})`,
        }),
      );
    }
    return ALL_OPTIONS;
  }, [countryCode]);

  const isCountryChanged = useIsChanged(countryCode);
  useEffect(() => {
    if (isCountryChanged) {
      const isStillAvailable = options.some((x) => x.value === value);
      if (!isStillAvailable) {
        onChange?.(previousChoices[countryCode ?? '']);
      }
    }
  }, [isCountryChanged, countryCode, onChange, previousChoices, options, value]);

  const handleChange = useCallback(
    (value) => {
      onChange?.(value);
      setPreviousChoices((prevState) => ({ ...prevState, [countryCode ?? '']: value }));
    },
    [onChange, countryCode],
  );
  return (
    <Select<string>
      value={value}
      onChange={handleChange}
      mode={'SINGLE'}
      options={options}
      placeholder={`Select region`}
      {...rest}
    />
  );
}
