import { difference, uniq } from 'lodash';
import { COUNTRY_GROUPS, expandCountryGroup } from '@flagright/lib/constants';
import { ListItem } from '@react-awesome-query-builder/core';

const getSelectedCountryGroups = (value: string[]) => {
  const allCountryGroups = Object.keys(COUNTRY_GROUPS);
  return value.filter((value) => allCountryGroups.includes(value));
};

export function serializeCountries(newValue?: string[]) {
  if (!newValue) {
    return [];
  }
  const selectedCountryGroups = getSelectedCountryGroups(newValue);
  return uniq([...expandCountryGroup(newValue), ...selectedCountryGroups]);
}

export const deserializeCountries = (value: string[]) => {
  if (!value) {
    return [];
  }
  const selectedCountryGroups = getSelectedCountryGroups(value);
  const groupCountries = expandCountryGroup(selectedCountryGroups);
  return difference(value, groupCountries);
};

export const omitCountryGroups = (options: (string | number | ListItem)[]) => {
  return options.filter((option) => {
    if (typeof option === 'string' || typeof option === 'number') {
      return true;
    }
    return !Object.keys(COUNTRY_GROUPS).includes(option.value as string);
  });
};

export const getFieldOptions = (fields: object, selectedField, fieldType?: string) => {
  const fieldOptions = Object.keys(fields)
    .filter((field) => fields[field].type === fieldType)
    .map((field) => ({
      key: field,
      path: field,
      label: fields[field].label,
      fieldSettings: fields['fieldSettings'],
    }))
    .filter((field) => field.key !== selectedField);
  return fieldOptions;
};

export const isAnyInOpreator = (operator) => {
  return operator === 'select_any_in' || operator === 'select_not_any_in';
};
export const isSimilarToOpreator = (operator) => {
  return operator === 'op:similarto' || operator === 'op:!similarto';
};
