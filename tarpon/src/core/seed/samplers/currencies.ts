import { randomInt } from '@/core/seed/samplers/prng'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'

const SAMPLE_CURRENCIES = ['USD', 'PHP', 'EUR', 'GBP'] as const

export function sampleCurrency(): CurrencyCode {
  return SAMPLE_CURRENCIES[randomInt(SAMPLE_CURRENCIES.length)]
}
