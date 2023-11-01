import { constants } from '@flagright/lib'

const COUNTRIES = constants.COUNTRIES

export type CountryCode = keyof typeof COUNTRIES

export function isCountryCode(val: unknown): val is CountryCode {
  if (val == null || typeof val !== 'string') {
    return false
  }
  return val in COUNTRIES
}

export function formatCountry(country: string | undefined): string | undefined {
  return isCountryCode(country) ? COUNTRIES[country] : country
}

export default COUNTRIES

const COUNTRY_GROUPS: { [key: string]: string[] } = {
  EEA: [
    'AT',
    'BE',
    'BG',
    'HR',
    'CY',
    'CZ',
    'DK',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'HU',
    'IS',
    'IE',
    'IT',
    'LV',
    'LI',
    'LT',
    'LU',
    'MT',
    'NL',
    'NO',
    'PL',
    'PT',
    'RO',
    'SK',
    'SI',
    'ES',
    'SE',
  ],
}

export function expandCountryGroup(countryCodes: string[]) {
  return countryCodes.flatMap(
    (countryCode) => COUNTRY_GROUPS[countryCode] || countryCode
  )
}

export const COUNTRY_CODES = Object.keys(COUNTRIES).concat(
  Object.keys(COUNTRY_GROUPS)
)
