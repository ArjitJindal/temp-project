export function getSecondsFromFormat(time: string) {
  return time.split(':').reduce((total, currentValue, index) => {
    if (index === 0) {
      return total + Number(currentValue) * 3600;
    } else if (index === 1) {
      return total + Number(currentValue) * 60;
    } else {
      return total + Number(currentValue);
    }
  }, 0);
}
import { difference, uniq } from 'lodash';
import { COUNTRY_GROUPS, expandCountryGroup } from '@flagright/lib/constants';
import { ListItem } from '@react-awesome-query-builder/core';

const getSelectedCountryGroups = (value: string[]) => {
  const allCountryGroups = Object.keys(COUNTRY_GROUPS);
  return value.filter((value) => allCountryGroups.includes(value));
};

export function serializeCountries(newValue?: string[]) {
  if (!newValue) return [];
  const selectedCountryGroups = getSelectedCountryGroups(newValue);
  return uniq([...expandCountryGroup(newValue), ...selectedCountryGroups]);
}

export const deserializeCountries = (value: string[]) => {
  if (!value) return [];
  const selectedCountryGroups = getSelectedCountryGroups(value);
  const groupCountries = expandCountryGroup(selectedCountryGroups);
  return difference(value, groupCountries);
};

export const omitCountryGroups = (options: (string | number | ListItem)[]) => {
  return options.filter((option) => {
    if (typeof option === 'string' || typeof option === 'number') return true;
    return !Object.keys(COUNTRY_GROUPS).includes(option.value as string);
  });
};
