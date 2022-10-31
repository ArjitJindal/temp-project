import { randomInt } from '@/utils/prng'

export function sampleCountry(seed?: number) {
  const COUNTRIES = ['PH', 'US', 'GB', 'AU', 'RU'] as const
  return COUNTRIES[randomInt(seed, COUNTRIES.length)]
}
