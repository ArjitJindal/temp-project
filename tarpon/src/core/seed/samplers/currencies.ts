import { randomInt } from '@/core/seed/samplers/prng'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'

const SAMPLE_CURRENCIES: CurrencyCode[] = ['USD']

export function sampleCurrency(seed?: number): CurrencyCode {
  return SAMPLE_CURRENCIES[randomInt(seed, SAMPLE_CURRENCIES.length)]
}
