import { randomInt } from '@/core/seed/samplers/prng'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'

export function sampleCountry(seed?: number): CountryCode {
  const COUNTRIES = ['PH', 'US', 'GB', 'AU', 'RU'] as const
  return COUNTRIES[randomInt(seed, COUNTRIES.length)]
}
