// According to https://www.iso.org/iso-3166-country-codes.html
import { constants } from '@flagright/lib';

const COUNTRIES = constants.COUNTRIES;

export const COUNTRY_NAME_ALIASES: { [key: string]: CountryCode } = {
  'United States': 'US',
  'United Kingdom': 'GB',
  'Republic of Moldova': 'MD',
  'Czech Republic': 'CZ',
  Turkey: 'TR',
  Russia: 'RU',
};

export const COUNTRY_NAME_TO_CODE = Object.fromEntries([
  ...Object.entries(COUNTRIES).map(([code, name]) => [name, code]),
  ...Object.entries(COUNTRY_NAME_ALIASES).map(([name, code]) => [name, code]),
]);

export type CountryCode = keyof typeof COUNTRIES;

export default COUNTRIES;
