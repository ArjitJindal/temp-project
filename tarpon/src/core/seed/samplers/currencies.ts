import { randomInt } from '@/utils/prng'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import { CURRENCY_CODES } from '@/@types/openapi-internal-custom/CurrencyCode'

export function sampleCurrency(seed?: number): CurrencyCode {
  return CURRENCY_CODES[randomInt(seed, CURRENCY_CODES.length)]
}
