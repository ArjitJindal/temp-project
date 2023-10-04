import { randomIntDeterministic } from '@/core/seed/samplers/prng'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'

const SAMPLE_CURRENCIES = ['USD', 'PHP', 'EUR', 'GBP'] as const

export function sampleCurrency(): CurrencyCode {
  return SAMPLE_CURRENCIES[randomIntDeterministic(SAMPLE_CURRENCIES.length)]
}
