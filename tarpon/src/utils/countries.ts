import {
  COUNTRIES,
  COUNTRY_GROUPS,
  COUNTRY_NAME_TO_CODE,
  COUNTRY_REGIONS,
  CountryCode,
  isCountryCode,
} from '@flagright/lib/constants/countries'

/*
  If val is a country code, returns as is, if not, tries to convert to country code
 */
export function normalizeCountryCode(val: unknown): CountryCode | null {
  if (typeof val !== 'string') {
    return null
  }
  if (isCountryCode(val)) {
    return val
  }
  const codeByName = COUNTRY_NAME_TO_CODE[val]
  return codeByName ?? null
}
export function normalizeCountryRegionCode(
  countryCode: CountryCode,
  regionNameOrCode: unknown
): string | null {
  if (typeof regionNameOrCode !== 'string') {
    return null
  }
  const countryRegions = COUNTRY_REGIONS[countryCode] ?? {}
  if (regionNameOrCode in countryRegions) {
    return regionNameOrCode
  }
  const [regionCode] =
    Object.entries(countryRegions).find(
      ([_, name]) => name === regionNameOrCode
    ) ?? []
  return regionCode ?? null
}

export function formatCountry(country: string | undefined): string | undefined {
  return isCountryCode(country) ? COUNTRIES[country] : country
}

export default COUNTRIES

export function expandCountryGroup(countryCodes: string[]) {
  return countryCodes.flatMap(
    (countryCode) => COUNTRY_GROUPS[countryCode] || countryCode
  )
}
