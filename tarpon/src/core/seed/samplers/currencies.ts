import { randomInt } from '@/utils/prng'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'

// NOTE: We limit the sample currencies to only 3 to reduce currency conversion cache miss
const SAMPLE_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP']

export function sampleCurrency(seed?: number): CurrencyCode {
  return SAMPLE_CURRENCIES[randomInt(seed, SAMPLE_CURRENCIES.length)]
}
