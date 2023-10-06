import { randomInt } from '@/core/seed/samplers/prng'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'

export function sampleCountry(): CountryCode {
  const COUNTRIES = ['PH', 'US', 'GB', 'AU', 'RU'] as const
  return COUNTRIES[randomInt(COUNTRIES.length)]
}
